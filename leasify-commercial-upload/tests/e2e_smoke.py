"""Browser smoke test for the server build.

Starts the server on a throwaway database schema, then:
  1. signs in as the CEO and visits every screen with no page errors
  2. moves a CRM client to another stage in one browser and sees it arrive in a second one
  3. reloads and checks it persisted
  4. signs in as an owner and checks only the owner portal shows

Run:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 tests/e2e_smoke.py
Needs Postgres (DATABASE_URL, default postgres://leasify:leasify@localhost:5432/leasify).
"""
import os, sys, subprocess, time, secrets, urllib.request, json, signal

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
DB = os.environ.get("DATABASE_URL", "postgres://leasify:leasify@localhost:5432/leasify")
SCHEMA = "e2e_" + secrets.token_hex(4)
PORT = int(os.environ.get("E2E_PORT", "3917"))
BASE = f"http://127.0.0.1:{PORT}"
PIN = "2580"
VIEWS = ["dashboard", "inbox", "inventory", "match", "copilot", "crm", "visits", "owners", "ceo", "team", "analytics", "settings"]

fails = []
def check(name, ok, extra=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(extra) if extra != "" else ""))
    if not ok: fails.append(name)

def wait_health(timeout=40):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(BASE + "/healthz", timeout=2) as r:
                if json.load(r).get("ok"): return True
        except Exception:
            time.sleep(0.3)
    return False

def drop_schema():
    code = ("const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,max:1});"
            f"p.query('DROP SCHEMA IF EXISTS \"{SCHEMA}\" CASCADE').finally(()=>p.end())")
    subprocess.run(["node", "-e", code], cwd=ROOT, env={**os.environ, "DATABASE_URL": DB}, check=False)

def new_page(browser, errs):
    ctx = browser.new_context(viewport={"width": 1400, "height": 900}, bypass_csp=True)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    # the first visit asks /api/me before anyone is signed in; the browser logs that expected 401, so it is not an error here
    pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" and "401" not in m.text else None)
    return ctx, pg

def sign_in(pg, key=None, owner=None):
    pg.goto(BASE + "/")
    pg.wait_for_selector("#au-form", timeout=15000)
    if owner:
        pg.click("[data-owner-radio]"); pg.select_option("#au-owner-sel", owner)
    else:
        pg.click(f'[data-key="{key}"]')
    pg.fill("#au-pin", PIN); pg.click("#au-go")
    pg.wait_for_selector(".app:not([inert])", timeout=15000)
    pg.wait_for_function("window.LC && LC.session && LC.net && LC.net.status && LC.net.status().connected", timeout=15000)

def navs(pg):
    return pg.evaluate("Array.from(document.querySelectorAll('.nav a[data-v]')).filter(a=>!a.hidden).map(a=>a.dataset.v)")

env = {**os.environ, "DATABASE_URL": DB, "DB_SCHEMA": SCHEMA, "PORT": str(PORT), "HOST": "127.0.0.1", "FLUSH_MS": "200"}
server = subprocess.Popen(["node", "server/index.js"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    if not wait_health():
        print("server did not start"); server.terminate(); print(server.stdout.read()); sys.exit(1)
    with sync_playwright() as p:
        b = p.chromium.launch()

        # wrong PIN first
        errs_x = []
        ctx0, pg0 = new_page(b, errs_x)
        pg0.goto(BASE + "/"); pg0.wait_for_selector("#au-form")
        pg0.click('[data-key="ceo"]'); pg0.fill("#au-pin", "1111"); pg0.click("#au-go")
        pg0.wait_for_function("document.querySelector('#au-err').textContent.length > 0", timeout=8000)
        check("a wrong PIN is refused with a message", "not right" in pg0.inner_text("#au-err"), pg0.inner_text("#au-err"))
        check("the demo PIN hint shows", "2580" in pg0.inner_text(".au-note"))
        ctx0.close()

        # 1. CEO visits every screen
        errs_a = []
        ctxA, A = new_page(b, errs_a)
        sign_in(A, "ceo")
        check("CEO sees every screen in the menu", navs(A) == VIEWS, navs(A))
        check("browser is in live mode", A.evaluate("LC.remote === true && window.LC_SERVER === true"))
        for v in VIEWS:
            A.evaluate(f"LC.go('{v}')"); A.wait_for_timeout(350)
            ok = A.evaluate(f"LC.current === '{v}' && !document.querySelector('#v-{v}').hidden && document.querySelector('#v-{v}').innerText.length > 20")
            check(f"view {v} renders", ok)
        check("zero page errors across every view", not errs_a, errs_a[:5])

        # 2. move a client's stage in A, see it in B
        errs_b = []
        ctxB, B = new_page(b, errs_b)
        sign_in(B, "ceo")
        target = A.evaluate("(() => { const c = LC.state.clients.find(x => x.stage === 'Qualified') || LC.state.clients.find(x => x.stage !== 'Site visit' && x.stage !== 'Lost'); return { id: c.id, from: c.stage }; })()")
        new_stage = "Site visit" if target["from"] != "Site visit" else "Proposal"
        A.evaluate("([id, st]) => LC.crm.moveStage(id, st)", [target["id"], new_stage])
        try:
            B.wait_for_function("([id, st]) => { const c = LC.state.clients.find(x => x.id === id); return c && c.stage === st; }", arg=[target["id"], new_stage], timeout=8000)
            check("a stage change in one browser shows up in the other", True)
        except Exception as e:
            check("a stage change in one browser shows up in the other", False, str(e)[:120])
        check("the other browser also got the timeline entry", B.evaluate("(id) => (LC.crm.get(id).stageHistory || []).length > 0", target["id"]))

        # 3. reload and it persisted
        time.sleep(1.0)
        A.reload(); A.wait_for_function("window.LC && LC.session && LC.net && LC.net.status().connected", timeout=15000)
        stage_after = A.evaluate("(id) => LC.crm.get(id).stage", target["id"])
        check("the change survives a reload", stage_after == new_stage, stage_after)

        # reset button: CEO only, and everyone gets the fresh data
        check("the reset button shows for the CEO", A.is_visible("#btn-reset"))
        A.click("#btn-reset"); A.click("#btn-reset")
        try:
            B.wait_for_function("(id) => !LC.state.clients.some(x => x.id === id) && LC.state.clients.length > 90", arg=target["id"], timeout=10000)   # reseeding makes new client ids
            check("resetting demo data reaches the other browser", True)
        except Exception as e:
            check("resetting demo data reaches the other browser", False, str(e)[:120])
        check("zero page errors in the second browser", not errs_b, errs_b[:5])
        check("zero page errors after reload", not errs_a, errs_a[:5])

        # sign out and back to the sign-in page
        A.evaluate("LC.net.logout().then(() => location.reload())"); A.wait_for_selector("#au-form", timeout=15000)
        check("signing out brings back the sign-in page", True)
        ctxA.close(); ctxB.close()

        ctxM, M = new_page(b, errs_x)
        sign_in(M, "rohit")
        check("the reset button is hidden for a manager", not M.is_visible("#btn-reset"))
        ctxM.close()

        # 4. owner sees only the owner portal
        errs_o = []
        ctxO, O = new_page(b, errs_o)
        O.goto(BASE + "/"); O.wait_for_selector("#au-form")
        owner_name = O.evaluate("document.querySelector('#au-owner-sel').value")
        sign_in(O, owner=owner_name)
        n = navs(O)
        check("an owner sees only the owner portal", n == ["owners"], n)
        O.evaluate("LC.go('crm')"); O.wait_for_timeout(300)
        check("an owner cannot open the CRM", O.evaluate("LC.current") == "owners", O.evaluate("LC.current"))
        mine = O.evaluate("LC.state.units.every(u => u.owner_name === LC.session.owner) && LC.state.units.length")
        check("an owner's browser only holds their own units", bool(mine), mine)
        check("an owner holds no leads or handoffs", O.evaluate("LC.state.leads.length === 0 && LC.state.queue.length === 0"))
        check("zero page errors for the owner", not errs_o, errs_o[:5])
        ctxO.close()
        b.close()
finally:
    server.send_signal(signal.SIGTERM)
    try: server.wait(timeout=12)
    except Exception: server.kill()
    drop_schema()

print("\n%d failed" % len(fails) if fails else "\nALL PASSED")
sys.exit(1 if fails else 0)
