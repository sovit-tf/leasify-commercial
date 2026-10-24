"""Browser test for the live agent layer (server build).

Starts the app with a fake WhatsApp (Graph) server and a fake OpenAI-style server, then:
  1. the simulator: start it from the inbox, see 30 chats, a second browser sees the same ones
  2. take over a chat, type as a person, hand it back; pick a chat up from the queue
  3. "Test as an occupier": the phone works end to end and the lead shows up in the other browser
  4. WhatsApp: a signed inbound message makes a "Live WhatsApp" chat; ticks follow the delivery callbacks;
     a failed send shows "Not delivered"
  5. Settings > Integrations shows WhatsApp and AI status; the co-pilot answers a free-form question through the fake AI
  6. "Switch user" returns to the sign-in page with the people panel

Run:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 tests/e2e_live.py
Needs Postgres (DATABASE_URL, default postgres://leasify:leasify@localhost:5432/leasify).
"""
import os, sys, subprocess, time, secrets, urllib.request, json, hmac, hashlib, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
DB = os.environ.get("DATABASE_URL", "postgres://leasify:leasify@localhost:5432/leasify")
SCHEMA = "live_" + secrets.token_hex(4)
PORT = int(os.environ.get("E2E_PORT", "3927"))
BASE = f"http://127.0.0.1:{PORT}"
PIN = "2580"
PHONE_ID = "1555000222"
APP_SECRET = "e2e-app-secret"
VERIFY = "e2e-verify-token"
WA_FROM = "919812345678"

fails = []
def check(name, ok, extra=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(extra) if extra != "" else ""))
    if not ok: fails.append(name)

# ---------------------------------------------------------------- fake outside services
graph_log = []     # every request the app sent to the fake Graph
ai_log = []        # every request the app sent to the fake AI
FAIL_MARK = "FAILME"

class Quiet(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n).decode("utf8") if n else ""
    def reply(self, code, obj):
        raw = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)

class Graph(Quiet):
    def do_POST(self):
        raw = self.body()
        try: body = json.loads(raw)
        except Exception: body = {}
        graph_log.append(body)
        text = ((body.get("text") or {}).get("body") or "")
        if FAIL_MARK in text:
            return self.reply(400, {"error": {"message": "Message undeliverable", "code": 131026}})
        self.reply(200, {"messaging_product": "whatsapp", "contacts": [{"wa_id": body.get("to")}], "messages": [{"id": "wamid.E2E" + secrets.token_hex(5)}]})

class Ai(Quiet):
    def do_POST(self):
        body = json.loads(self.body() or "{}")
        ai_log.append(body)
        msgs = body.get("messages") or []
        has_tool_result = any(m.get("role") == "tool" for m in msgs)
        tools = body.get("tools") or []
        if tools and not has_tool_result:
            name = tools[0]["function"]["name"]
            msg = {"role": "assistant", "content": None, "tool_calls": [{"id": "call_e2e", "type": "function", "function": {"name": name, "arguments": "{}"}}]}
            fin = "tool_calls"
        else:
            msg = {"role": "assistant", "content": "The owners are all very calm. The data has no mood column, so I cannot rank them."}
            fin = "stop"
        self.reply(200, {"id": "x", "object": "chat.completion", "model": "e2e-model", "choices": [{"index": 0, "message": msg, "finish_reason": fin}]})

def serve(handler):
    s = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s

graph_srv, ai_srv = serve(Graph), serve(Ai)

# ---------------------------------------------------------------- helpers
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
    ctx = browser.new_context(viewport={"width": 1500, "height": 950}, bypass_csp=True)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" and "401" not in m.text else None)
    return ctx, pg

def sign_in(pg, key):
    pg.goto(BASE + "/")
    pg.wait_for_selector("#au-form", timeout=15000)
    pg.click(f'[data-key="{key}"]')
    pg.fill("#au-pin", PIN); pg.click("#au-go")
    pg.wait_for_selector(".app:not([inert])", timeout=15000)
    pg.wait_for_function("window.LC && LC.session && LC.net && LC.net.status && LC.net.status().connected", timeout=15000)

def wait(pg, js, arg=None, timeout=20000, name=None):
    try:
        pg.wait_for_function(js, arg=arg, timeout=timeout); return True
    except Exception as e:
        if name: print("   (timeout: %s) %s" % (name, str(e)[:100]))
        return False

def webhook(payload, secret=APP_SECRET):
    raw = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    req = urllib.request.Request(BASE + "/webhook/whatsapp", data=raw, headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r: return r.status

def wa_inbound(text, from_=WA_FROM, name="Meera Joshi"):
    return {"object": "whatsapp_business_account", "entry": [{"id": "1", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "metadata": {"phone_number_id": PHONE_ID},
        "contacts": [{"profile": {"name": name}, "wa_id": from_}],
        "messages": [{"from": from_, "id": "wamid.IN" + secrets.token_hex(6), "timestamp": str(int(time.time())), "type": "text", "text": {"body": text}}]}}]}]}

def wa_status(wamid, status):
    return {"object": "whatsapp_business_account", "entry": [{"id": "1", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "metadata": {"phone_number_id": PHONE_ID},
        "statuses": [{"id": wamid, "status": status, "timestamp": str(int(time.time())), "recipient_id": WA_FROM}]}}]}]}

env = {**os.environ, "DATABASE_URL": DB, "DB_SCHEMA": SCHEMA, "PORT": str(PORT), "HOST": "127.0.0.1", "FLUSH_MS": "200",
       "PUBLIC_BASE_URL": BASE,
       "WA_TOKEN": "e2e-token", "WA_PHONE_NUMBER_ID": PHONE_ID, "WA_APP_SECRET": APP_SECRET, "WA_VERIFY_TOKEN": VERIFY,
       "WA_GRAPH_BASE": f"http://127.0.0.1:{graph_srv.server_port}", "WA_RETRY_MS": "50",
       "AI_BASE_URL": f"http://127.0.0.1:{ai_srv.server_port}/v1", "AI_API_KEY": "e2e-key", "AI_MODEL": "e2e-model"}
server = subprocess.Popen(["node", "server/index.js"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    if not wait_health():
        print("server did not start"); server.terminate(); print(server.stdout.read()); sys.exit(1)
    with sync_playwright() as p:
        b = p.chromium.launch()
        errs_a, errs_b = [], []
        ctxA, A = new_page(b, errs_a)
        ctxB, B = new_page(b, errs_b)
        sign_in(A, "ceo"); sign_in(B, "rohit")
        check("both browsers are in live mode", A.evaluate("LC.remote === true") and B.evaluate("LC.remote === true"))
        check("the visible tag says AI, not a product name", A.evaluate("LC.aiName") == "AI")

        # ------------------------------------------------ 1. the simulator
        A.evaluate("LC.go('inbox')"); A.wait_for_selector(".ib-strip")
        A.evaluate("LC.go('inbox')") if False else None
        check("no engine runs in the browser: no local timers advance leads", A.evaluate("LC.state.leads.length") == 0)
        A.click('[data-sp="6"]')
        A.click('[data-a="sim30"]')
        ok = wait(A, "LC.state.leads.length >= 30", timeout=60000, name="30 leads")
        check("the simulator started from the inbox produces 30 chats", ok, A.evaluate("LC.state.leads.length"))
        check("the list shows the chats", wait(A, "document.querySelectorAll('.ib-row').length >= 30", timeout=10000, name="rows"), A.evaluate("document.querySelectorAll('.ib-row').length"))
        time.sleep(1.0)
        check("the live counter is alive", int(A.inner_text('[data-k="live"]') or 0) > 0, A.inner_text('[data-k="live"]'))
        check("the speed buttons follow the server", A.get_attribute('[data-sp="6"]', "aria-pressed") == "true")
        sim_pill = A.is_visible("#sim-pill")
        check("the simulator pill shows", sim_pill)
        B.evaluate("LC.go('inbox')"); B.wait_for_selector(".ib-strip")
        same = wait(B, "LC.state.leads.length >= 30", timeout=15000, name="B sees 30")
        check("a second browser sees the same chats", same)
        ids_a = set(A.evaluate("LC.state.leads.map(l => l.id)")); ids_b = set(B.evaluate("LC.state.leads.map(l => l.id)"))
        check("the same ids on both sides", ids_a == ids_b, f"{len(ids_a)} vs {len(ids_b)}")
        check("B's pill and speed follow A's switch", B.get_attribute('[data-sp="6"]', "aria-pressed") == "true")
        A.click("#ib-pause")
        check("pause reaches the other browser", wait(B, "document.querySelector('#sim-pill-t') && /paused/i.test(document.querySelector('#sim-pill-t').textContent)", timeout=10000, name="pause"))
        A.click("#ib-pause")
        wait(B, "document.querySelector('#sim-pill-t') && !/paused/i.test(document.querySelector('#sim-pill-t').textContent)", timeout=10000)
        # turn the simulated team off so queue items stay waiting
        A.uncheck("#ib-team")
        check("the team switch reaches the server", wait(B, "!document.querySelector('#ib-team').checked", timeout=10000, name="team off"))

        # ------------------------------------------------ 2. take over, type, hand back, queue
        me = A.evaluate("LC.session.name")
        target = None
        for _ in range(60):
            target = A.evaluate("(() => { const l = LC.state.leads.find(x => x.status === 'ai' && x.channel === 'sim'); return l ? l.id : null; })()")
            if target: break
            time.sleep(0.5)
        check("there is a chat the AI is handling", bool(target))
        A.evaluate("(id) => { document.querySelector('.ib-tabs [data-tab=\"all\"]').click(); }", target)
        A.wait_for_selector(f'.ib-row[data-id="{target}"]')
        A.click(f'.ib-row[data-id="{target}"]')
        A.wait_for_selector('[data-act="take"]')
        A.click('[data-act="take"]')
        check("take over: the chat is with me on the server", wait(A, "(id) => { const l = LC.state.leads.find(x => x.id === id); return l && l.status === 'human'; }", arg=target, name="human"))
        check("take over reached the other browser", wait(B, "([id, me]) => { const l = LC.state.leads.find(x => x.id === id); return l && l.status === 'human' && l.humanBy === me; }", arg=[target, me], name="B human"))
        A.wait_for_selector("#ib-msg")
        A.fill("#ib-msg", "Hello, this is a person typing from the browser.")
        A.press("#ib-msg", "Enter")
        check("my message appears in the thread", wait(A, "document.querySelector('#ib-body') && document.querySelector('#ib-body').innerText.includes('this is a person typing')", name="my msg"))
        check("the message is on the server, under my name", wait(B, "([id, me]) => { const l = LC.state.leads.find(x => x.id === id); return l && l.messages.some(m => m.from === 'agent' && m.by === me && m.text.includes('person typing')); }", arg=[target, me], name="B has msg"))
        check("the input was cleared", A.input_value("#ib-msg") == "")
        A.click('[data-act="back"]')
        check("hand back: the AI has the chat again", wait(A, "(id) => { const l = LC.state.leads.find(x => x.id === id); return l && l.status !== 'human'; }", arg=target, name="back"))
        check("hand back reached the other browser", wait(B, "(id) => { const l = LC.state.leads.find(x => x.id === id); return l && l.status !== 'human'; }", arg=target))

        waiting = None
        for _ in range(90):
            waiting = A.evaluate("(() => { const l = LC.state.leads.find(x => x.status === 'handoff'); return l ? l.id : null; })()")
            if waiting: break
            time.sleep(0.5)
        check("a chat reached the handoff queue", bool(waiting))
        if waiting:
            A.click('.ib-tabs [data-tab="needs"]')
            A.wait_for_selector(f'[data-pickup="{waiting}"]')
            A.click(f'[data-pickup="{waiting}"]')
            check("pick up from the queue: the chat is with me", wait(A, "(id) => { const l = LC.state.leads.find(x => x.id === id); return l && l.status === 'human'; }", arg=waiting, name="picked"))
            check("the queue item left the waiting list", wait(B, "(id) => { const l = LC.state.leads.find(x => x.id === id); return l && l.status === 'human'; }", arg=waiting))
            A.click('[data-act="back"]')
        A.click('.ib-tabs [data-tab="all"]')

        # ------------------------------------------------ 3. test as an occupier
        A.click('[data-a="test"]')
        A.wait_for_selector("#tp-start")
        A.click("#tp-start")
        A.wait_for_selector("#ph-body .bub")
        check("the phone shows the occupier's first message", A.evaluate("document.querySelectorAll('#ph-body .bub.out').length") >= 1)
        check("the agent answers on the phone", wait(A, "document.querySelectorAll('#ph-body .bub.in').length >= 1", timeout=15000, name="phone reply"))
        n_in = A.evaluate("document.querySelectorAll('#ph-body .bub.in').length")
        A.fill("#ph-in", "I need an office in Patia, about 2000 sq ft")
        A.press("#ph-in", "Enter")
        check("my phone message goes out and a further reply comes back", wait(A, "(n) => document.querySelectorAll('#ph-body .bub.in').length > n", arg=n_in, timeout=15000, name="phone reply 2"))
        check("the phone shows suggested answers for the presenter", A.evaluate("document.querySelectorAll('#ph-sug .chip').length") > 0)
        test_id = A.evaluate("(() => { const l = LC.state.leads.filter(x => x.channel === 'test').pop(); return l ? l.id : null; })()")
        check("the test chat is a lead on the server and in the other browser", bool(test_id) and wait(B, "(id) => LC.state.leads.some(l => l.id === id && l.messages.length >= 3)", arg=test_id, name="B test lead"))
        A.keyboard.press("Escape")
        A.evaluate("LC.closeDrawer && LC.closeDrawer()")

        # ------------------------------------------------ 4. WhatsApp
        try:
            webhook(wa_inbound("hello"), secret="wrong"); refused = False
        except urllib.error.HTTPError as e:
            refused = e.code == 401
        check("a post signed with the wrong secret gets 401", refused)
        check("a signed inbound message is accepted", webhook(wa_inbound("Hello, I need an office in Patia, 2000 sq ft, budget 80 per sq ft")) == 200)
        A.click('.ib-tabs [data-tab="all"]')
        check("a Live WhatsApp chat appears for it", wait(A, "LC.state.leads.some(l => l.channel === 'whatsapp')", timeout=15000, name="wa lead"))
        wa_id = A.evaluate("LC.state.leads.find(l => l.channel === 'whatsapp').id")
        A.evaluate("(id) => LC.openLead(id)", wa_id)
        A.wait_for_selector(f'.ib-row[data-id="{wa_id}"]')
        check("the list row carries the green Live WhatsApp pill", A.locator(f'.ib-row[data-id="{wa_id}"] .ib-wa').count() == 1)
        check("the thread header carries it too", wait(A, "document.querySelector('#ib-th .ib-wa') !== null", name="head pill"))
        check("the lead's name comes from the WhatsApp profile", "Meera Joshi" in A.inner_text(f'.ib-row[data-id="{wa_id}"]'))
        check("the AI reply goes out through Graph and shows one tick", wait(A, "document.querySelector('#ib-body .bub.out .ib-tick') && /✓/.test(document.querySelector('#ib-body .bub.out .ib-tick').textContent)", timeout=15000, name="tick sent"))
        sent = [g for g in graph_log if g.get("type") == "text"]
        check("Graph got a text payload for the right number", bool(sent) and sent[0].get("to") == WA_FROM and sent[0].get("messaging_product") == "whatsapp", sent[:1])
        wamid = A.evaluate("(id) => { const l = LC.state.leads.find(x => x.id === id); const m = l.messages.find(x => x.from === 'ai' && x.wa && x.wa.id); return m ? m.wa.id : null; }", wa_id)
        check("the message carries its WhatsApp id", bool(wamid), wamid)
        webhook(wa_status(wamid, "delivered"))
        check("delivered shows two ticks", wait(A, "document.querySelector('#ib-body .bub.out .ib-tick') && document.querySelector('#ib-body .bub.out .ib-tick').textContent.trim() === '✓✓'", timeout=10000, name="delivered"))
        webhook(wa_status(wamid, "read"))
        check("read shows two ticks in the brand colour", wait(A, "document.querySelector('#ib-body .bub.out .ib-tick.read') !== null", timeout=10000, name="read"))
        if os.environ.get("E2E_SHOTS"): A.screenshot(path=os.path.join(os.environ["E2E_SHOTS"], "wa_thread.png"))
        # a person takes the WhatsApp chat and the send fails
        A.click('[data-act="take"]'); A.wait_for_selector("#ib-msg")
        A.fill("#ib-msg", "Hello Meera " + FAIL_MARK); A.press("#ib-msg", "Enter")
        check("a failed send shows Not delivered", wait(A, "document.querySelector('#ib-body .ib-fail') !== null", timeout=15000, name="failed"))
        check("the failure text is plain and visible", "Not delivered" in A.inner_text("#ib-body"))
        A.fill("#ib-msg", "Hello Meera, this one should go through"); A.press("#ib-msg", "Enter")
        for _ in range(40):
            if any("should go through" in ((g.get("text") or {}).get("body") or "") for g in graph_log): break
            time.sleep(0.25)
        check("the next message still goes out", any("should go through" in ((g.get("text") or {}).get("body") or "") for g in graph_log))
        if os.environ.get("E2E_SHOTS"): A.screenshot(path=os.path.join(os.environ["E2E_SHOTS"], "wa_failed.png"))
        A.click('[data-act="back"]')

        # ------------------------------------------------ 5. settings, co-pilot
        A.evaluate("LC.go('settings')"); A.wait_for_selector('[data-tab="integrations"]')
        A.click('[data-tab="integrations"]')
        check("Integrations shows live WhatsApp status", wait(A, "document.querySelector('#st-wa-card') && /Connected/.test(document.querySelector('#st-wa-card').innerText)", timeout=10000, name="wa card"))
        txt = A.inner_text("#st-wa-card")
        check("the webhook URL is shown", BASE + "/webhook/whatsapp" in txt, txt[:200])
        if os.environ.get("E2E_SHOTS"): A.screenshot(path=os.path.join(os.environ["E2E_SHOTS"], "integrations.png"))
        check("there is a copy button", A.locator("#st-wa-card [data-copy]").count() == 1)
        check("the AI card names the model", wait(A, "document.querySelector('#st-ai-card') && /e2e-model/.test(document.querySelector('#st-ai-card').innerText)", timeout=10000, name="ai card"))
        check("no secret is shown", "e2e-token" not in A.inner_text(".content, main, body") and APP_SECRET not in A.inner_text("body") and "e2e-key" not in A.inner_text("body"))
        check("Settings says data is saved on the server", "Saved on the server" in A.inner_text("body"))
        check("Settings does not claim the browser keeps the data", "keeps everything in your browser" not in A.inner_text("body"))

        A.evaluate("LC.go('copilot')"); A.wait_for_selector("#cp-in")
        A.fill("#cp-in", "Which locality has the most grumpy owners?")
        A.press("#cp-in", "Enter")
        check("the co-pilot answers a free-form question through the AI service", wait(A, "document.querySelector('.msg.ai[data-intent=\"claude\"]') !== null", timeout=25000, name="copilot ai"))
        ans = A.inner_text('.msg.ai[data-intent="claude"]')
        check("the answer is the fake model's text", "no mood column" in ans, ans[:120])
        check("the answer is tagged AI", A.inner_text('.msg.ai[data-intent="claude"] .ai-tag').strip() == "AI")
        check("the browser's tool loop called a page tool and sent the result back", any(any(m.get("role") == "tool" for m in r.get("messages", [])) for r in ai_log))
        check("no phone number went to the AI service", not any(__import__("re").search(r"\b\d{10}\b", json.dumps(r)) for r in ai_log))

        # ------------------------------------------------ 6. switch user
        A.click("#user-chip")
        A.click('[data-pop="switch"]')
        A.wait_for_selector("#au-form", timeout=15000)
        check("Switch user brings back the sign-in page with the people panel", A.locator("[data-key]").count() >= 5, A.locator("[data-key]").count())
        check("the old session is gone", A.evaluate("fetch('/api/me').then(r => r.status)") == 401)
        sign_in(A, "priyanka")
        check("a different person can sign in right after", A.evaluate("LC.session.name") != me)

        check("zero page errors in the first browser", not [e for e in errs_a if "Failed to load resource" not in e], errs_a[:4])
        check("zero page errors in the second browser", not [e for e in errs_b if "Failed to load resource" not in e], errs_b[:4])
        ctxA.close(); ctxB.close(); b.close()
finally:
    server.terminate()
    try: server.wait(timeout=8)
    except Exception: server.kill()
    graph_srv.shutdown(); ai_srv.shutdown()
    drop_schema()

print("\nALL PASSED" if not fails else "\nFAILED: " + "; ".join(fails))
sys.exit(1 if fails else 0)
