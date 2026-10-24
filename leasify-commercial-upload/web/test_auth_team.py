"""Sign-in, roles and team report cards. python3 test_auth_team.py [html]"""
import sys, os, json
from playwright.sync_api import sync_playwright
html = sys.argv[1] if len(sys.argv) > 1 else "dist/Leasify_Commercial_Demo.html"
shots = "shots/auth"; os.makedirs(shots, exist_ok=True)
URL = "file://" + os.path.abspath(html)
fails = []
def check(name, ok, extra=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(extra) if extra != "" else ""))
    if not ok: fails.append(name)

def new(b, w=1400, h=900, scheme="light", skip=False):
    pg = b.new_page(viewport={"width": w, "height": h}, color_scheme=scheme)
    errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" else None)
    if skip: pg.add_init_script("window.__LC_SKIP_LOGIN = true")
    pg.goto(URL); pg.wait_for_timeout(500)
    return pg, errs

def sign_in(pg, key=None, owner=None):
    if owner:
        pg.click("[data-owner-radio]"); pg.select_option("#au-owner-sel", owner)
    else:
        pg.click(f'[data-key="{key}"]')
    pg.fill("#au-pin", "4321"); pg.click("#au-go"); pg.wait_for_timeout(500)

def navs(pg):
    return pg.evaluate("Array.from(document.querySelectorAll('.nav a[data-v]')).filter(a=>!a.hidden).map(a=>a.dataset.v)")

EXPECT = {
  "ceo": ["dashboard","inbox","inventory","match","copilot","crm","visits","owners","ceo","team","analytics","settings"],
  "rohit": ["dashboard","inbox","inventory","match","copilot","crm","visits","owners","ceo","team","analytics"],
  "priyanka": ["dashboard","inbox","inventory","match","copilot","crm","visits","team"],
}
with sync_playwright() as p:
    b = p.chromium.launch()
    # (a) sign-in page shows and every role
    pg, errs = new(b)
    check("sign-in page shows", pg.is_visible("#au-h") and "Sign in to your leasing desk" in pg.inner_text("#au-h"))
    check("app is inert behind the sign-in page", pg.evaluate("document.querySelector('.app').hasAttribute('inert')"))
    txt = pg.inner_text("#login-root")
    check("demo panel lists 6 people + owner", pg.locator("[data-key]").count() == 6 and "Sign in as an owner" in txt)
    check("PIN note present", "Demo: any PIN works. In the live product each person signs in with their phone number and a one-time code." in txt)
    check("no em-dash on sign-in page", "—" not in txt)
    pg.screenshot(path=f"{shots}/signin-desk.png")
    # bad pin
    pg.fill("#au-pin", "12"); pg.click("#au-go"); check("short PIN rejected", "4-digit" in pg.inner_text("#au-err"))
    pg.fill("#au-pin", "1234")
    pg.fill("#au-id", "nobody@example.com"); pg.click("#au-go"); check("unknown id rejected", "not on the demo list" in pg.inner_text("#au-err"))
    # keyboard: arrow keys move selection
    pg.focus('[data-key="ceo"]'); pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(100)
    check("arrow key selects next person", pg.get_attribute('[data-key="rohit"]', "aria-checked") == "true")
    sign_in(pg, "ceo")
    check("overlay removed after sign in", pg.evaluate("document.querySelector('#login-root').innerHTML === ''"))
    check("CEO sees all nav", navs(pg) == EXPECT["ceo"], navs(pg))
    check("session recorded", pg.evaluate("LC.session.signedIn && LC.session.logins.length===1 && LC.state.me==='Sanjeev Das'"))
    pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(300); check("CEO can open settings", pg.evaluate("LC.current")=="settings")
    # manager
    pg.click("#user-chip"); pg.wait_for_timeout(200)
    check("user menu opens", pg.is_visible(".au-pop") and "Signed in since" in pg.inner_text(".au-pop"))
    check("menu has team report cards for CEO", "My team's report cards" in pg.inner_text(".au-pop"))
    pg.click('[data-pop="switch"]'); pg.wait_for_timeout(300)
    check("switch user shows sign-in again", pg.is_visible("#au-h"))
    sign_in(pg, "rohit")
    check("manager nav", navs(pg) == EXPECT["rohit"], navs(pg))
    check("manager state.me", pg.evaluate("LC.state.me") == "Rohit Mohanty")
    pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(300)
    check("manager #settings redirects home", pg.evaluate("LC.current")=="dashboard" and pg.evaluate("location.hash")=="#dashboard", pg.evaluate("location.hash"))
    # executive
    pg.click("#user-chip"); pg.click('[data-pop="out"]'); pg.wait_for_timeout(300)
    check("sign out shows sign-in page", pg.is_visible("#au-h") and pg.evaluate("LC.session.signedIn")==False)
    sign_in(pg, "priyanka")
    check("executive nav", navs(pg) == EXPECT["priyanka"], navs(pg))
    for h in ("settings", "ceo", "owners", "analytics"):
        pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(250)
        check(f"executive #{h} redirects home", pg.evaluate("LC.current")=="dashboard", pg.evaluate("LC.current"))
    check("executive nav label", "My report card" in pg.inner_text('.nav a[data-v="team"]'))
    pg.evaluate("location.hash='dashboard'"); pg.wait_for_timeout(300)
    check("dashboard My work card", "My work" in pg.inner_text("#v-dashboard") and "Priyanka Das" in pg.inner_text("#db-mine"))
    pg.screenshot(path=f"{shots}/exec-dashboard.png")
    pg.evaluate("location.hash='crm'"); pg.wait_for_timeout(500)
    check("CRM opens on own clients", pg.input_value("#crm-f-agent") == "Priyanka Das")
    pg.click("#crm-clear"); check("CRM filter can be cleared", pg.input_value("#crm-f-agent") == "")
    pg.evaluate("location.hash='dashboard'"); pg.wait_for_timeout(200); pg.evaluate("location.hash='crm'"); pg.wait_for_timeout(300)
    check("cleared filter stays cleared", pg.input_value("#crm-f-agent") == "")
    pg.evaluate("location.hash='inbox'"); pg.wait_for_timeout(500)
    check("inbox has Assigned to me tab", "Assigned to me" in pg.inner_text("#ib-tabs"))
    # (c) executive sees only own card
    pg.evaluate("location.hash='team'"); pg.wait_for_timeout(600)
    t = pg.inner_text("#v-team"); title = pg.inner_text("#v-title")
    check("exec title 'My report card'", title == "My report card", title)
    check("exec sees own card only", "Priyanka Das" in t and "Leaderboard" not in t and "Subham" not in t and "Satya" not in t and pg.locator("#v-team .tm-sec").count()==6)
    pg.evaluate("LC.openReportCard('Satya Prakash Jena')"); pg.wait_for_timeout(400)
    check("exec cannot open another card", "Satya" not in pg.inner_text(".drawer") and "My report card" in pg.inner_text(".drawer"))
    pg.keyboard.press("Escape")
    # (e) reset keeps user
    pg.click("#btn-reset"); pg.wait_for_timeout(600)
    check("reset keeps executive", pg.evaluate("LC.session.role")=="executive" and pg.evaluate("LC.session.name")=="Priyanka Das" and pg.evaluate("LC.state.me")=="Priyanka Das" and navs(pg)==EXPECT["priyanka"])
    # (b) owner
    pg.click("#user-chip"); pg.click('[data-pop="switch"]'); pg.wait_for_timeout(300)
    owners = pg.evaluate("Array.from(document.querySelectorAll('#au-owner-sel option')).map(o=>o.value)")
    check("owner list from units", len(owners) == 15, len(owners))
    sign_in(pg, owner=owners[3])
    check("owner nav only owners", navs(pg) == ["owners"], navs(pg))
    pg.wait_for_timeout(400)
    o = pg.inner_text("#v-owners")
    check("owner portal locked to own owner", owners[3] in pg.inner_text("#own-top") and pg.locator("#own-pick").count()==0 and "Team view" not in o and "All owners" not in o)
    pg.evaluate("location.hash='ceo'"); pg.wait_for_timeout(250); check("owner #ceo redirects home", pg.evaluate("LC.current")=="owners")
    pg.evaluate("location.hash='dashboard'"); pg.wait_for_timeout(250); check("owner #dashboard redirects home", pg.evaluate("LC.current")=="owners")
    pg.evaluate("LC.$('#own-top')"); 
    # try to force-switch owner programmatically via UI hooks
    pg.evaluate("document.querySelectorAll('[data-act=\"mode\"]').forEach(b=>b.click())"); pg.wait_for_timeout(200)
    check("owner cannot switch mode", "Team view" not in pg.inner_text("#v-owners") and owners[3] in pg.inner_text("#own-top"))
    pg.click("#btn-reset"); pg.wait_for_timeout(500)
    check("reset keeps owner", pg.evaluate("LC.session.role")=="owner" and owners[3] in pg.inner_text("#own-top"))
    pg.screenshot(path=f"{shots}/owner.png")
    check("no page errors (flow)", not errs, errs)
    pg.close()

    # (d) CEO leaderboard
    pg, errs = new(b, skip=True)
    pg.evaluate("LC.signIn({name: LC.CEO.name, role: 'ceo'})"); pg.evaluate("location.hash='team'"); pg.wait_for_timeout(700)
    check("leaderboard has 5 rows", pg.locator("#v-team .tm-lb tbody tr").count() == 5)
    for d in (7, 30, 70):
        rows = pg.evaluate(f"LC.team.board({d})")
        check(f"all scores numeric 0-100 ({d} days)", len(rows)==5 and all(isinstance(r['score'], (int,float)) and 0 <= r['score'] <= 100 for r in rows), [r['score'] for r in rows])
        check(f"section scores are numbers or null ({d})", all(s['score'] is None or 0<=s['score']<=100 for r in rows for s in r['sections']))
    for d in (7, 70):
        pg.click(f'[data-days="{d}"]'); pg.wait_for_timeout(300)
        body = pg.inner_text("body"); check(f"no NaN/undefined/null on team page ({d} days)", all(x not in body for x in ("NaN", "undefined", "null", "Infinity")))
    pg.click('[data-days="30"]'); pg.wait_for_timeout(200)
    # sort
    pg.click('[data-sort="earned"]'); pg.wait_for_timeout(200)
    first = pg.inner_text("#v-team .tm-lb tbody tr:first-child .tm-link")
    check("sort by brokerage puts Satya first", first == "Satya Prakash Jena", first)
    pg.click('[data-sort="score"]'); pg.wait_for_timeout(200)
    # open each card
    for name in ["Rohit Mohanty","Priyanka Das","Subham Sahoo","Ananya Patnaik","Satya Prakash Jena"]:
        pg.evaluate(f"LC.openReportCard('{name}')"); pg.wait_for_timeout(300)
        d = pg.inner_text(".drawer")
        check(f"card {name}", d.count("Rule.") == 6 and "Strengths" in d and "Focus" in d and "How the score works" in d and all(x not in d for x in ("NaN","undefined","null","—")))
        pg.keyboard.press("Escape")
    pg.click('tr[data-card="Ananya Patnaik"]'); pg.wait_for_timeout(300)
    check("row click opens card", "Ananya Patnaik: report card" in pg.inner_text(".drawer"))
    pg.click('.drawer [data-days="7"]'); pg.wait_for_timeout(300)
    check("period change inside card", "Last 7 days" in pg.inner_text(".drawer .tm-meta"))
    pg.keyboard.press("Escape")
    # CEO co-pilot
    pg.evaluate("location.hash='ceo'"); pg.wait_for_timeout(500)
    pg.fill("#ceo-in", "Show Ananya's report card"); pg.press("#ceo-in", "Enter"); pg.wait_for_timeout(1500)
    check("co-pilot opens named report card", pg.is_visible(".drawer") and "Ananya Patnaik" in pg.inner_text(".drawer"))
    pg.keyboard.press("Escape")
    pg.fill("#ceo-in", "agent report card"); pg.press("#ceo-in", "Enter"); pg.wait_for_timeout(1500)
    check("co-pilot generic has Open report cards button", "Open report cards" in pg.inner_text("#v-ceo"))
    pg.fill("#ceo-in", "show me the team scorecard"); pg.press("#ceo-in", "Enter"); pg.wait_for_timeout(1500)
    check("team scorecard has Open report cards button", pg.locator("#v-ceo button:has-text('Open report cards')").count() >= 1)
    pg.locator("#v-ceo button:has-text('Open report cards')").last.click(); pg.wait_for_timeout(500)
    check("button goes to team view", pg.evaluate("LC.current")=="team")
    check("no page errors (team)", not errs, errs)
    # (g) dark theme
    pg.evaluate("document.documentElement.dataset.theme='dark'"); pg.wait_for_timeout(200)
    pg.screenshot(path=f"{shots}/leaderboard-dark.png", full_page=True)
    pg.evaluate("LC.openReportCard('Subham Sahoo')"); pg.wait_for_timeout(500)
    pg.screenshot(path=f"{shots}/card-dark.png")
    pg.evaluate("document.documentElement.dataset.theme='light'"); pg.evaluate("LC.closeDrawer()")
    pg.screenshot(path=f"{shots}/leaderboard-desk.png", full_page=True)
    pg.evaluate("LC.openReportCard('Subham Sahoo')"); pg.wait_for_timeout(400)
    h = pg.evaluate("document.querySelector('.drawer-b').scrollHeight"); pg.set_viewport_size({"width":1400,"height":h+100}); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{shots}/card-desk.png")
    pg.close()

    # (f) phone overflow and screenshots
    pg, errs = new(b, 390, 844)
    ov = lambda: pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("phone sign-in overflow 0", ov() == 0, ov())
    pg.screenshot(path=f"{shots}/signin-phone.png", full_page=True)
    pg.evaluate("document.documentElement.dataset.theme='dark'"); pg.screenshot(path=f"{shots}/signin-dark.png"); pg.evaluate("document.documentElement.dataset.theme='light'")
    sign_in(pg, "ceo"); pg.evaluate("location.hash='team'"); pg.wait_for_timeout(600)
    check("phone team view overflow 0", ov() == 0, ov()); pg.screenshot(path=f"{shots}/leaderboard-phone.png", full_page=True)
    pg.evaluate("LC.openReportCard('Ananya Patnaik')"); pg.wait_for_timeout(500)
    check("phone card overflow 0", ov() == 0, ov()); pg.screenshot(path=f"{shots}/card-phone.png")
    pg.evaluate("LC.closeDrawer()")
    pg.click("#user-chip"); pg.wait_for_timeout(200); pg.screenshot(path=f"{shots}/menu-phone.png"); check("phone menu overflow 0", ov() == 0)
    pg.click('[data-pop="out"]'); sign_in(pg, "satya"); pg.wait_for_timeout(300)
    check("phone exec dashboard overflow 0", ov() == 0, ov()); pg.screenshot(path=f"{shots}/exec-dashboard-phone.png")
    pg.evaluate("location.hash='team'"); pg.wait_for_timeout(500); check("phone exec card overflow 0", ov() == 0, ov())
    check("no page errors (phone)", not errs, errs)
    pg.close(); b.close()
print("\nFAILED:", fails if fails else "none")
sys.exit(1 if fails else 0)
