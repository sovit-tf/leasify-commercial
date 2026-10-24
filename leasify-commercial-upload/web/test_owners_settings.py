"""Click-through test for the owners and settings views.
   python3 test_owners_settings.py dist/t-os.html [--shots dir]"""
import sys, os, json
from playwright.sync_api import sync_playwright
html = sys.argv[1]
shots = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else "shots/os2"
os.makedirs(shots, exist_ok=True)
fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" :: " + str(extra) if extra and not cond else ""))
    if not cond: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1000}); pg.add_init_script('window.__LC_SKIP_LOGIN = true')
    errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.abspath(html)); pg.wait_for_timeout(600)

    # ---------- owners ----------
    pg.evaluate("location.hash='owners'"); pg.wait_for_timeout(500)
    owner = pg.evaluate("""()=>{const g={};LC.state.units.forEach(u=>g[u.owner_name]=(g[u.owner_name]||0)+1);return Object.entries(g).sort((a,b)=>b[1]-a[1])[0][0]}""")
    pg.select_option("#own-pick", owner); pg.wait_for_timeout(200)
    check("team view shows internal strip", pg.locator(".own-internal").count() > 0)
    check("team view shows all owners table", pg.locator("#own-data table.tbl").count() > 0)
    pg.screenshot(path=f"{shots}/owners-team-full.png", full_page=True)
    pg.click("[data-act=mode][data-v=owner]"); pg.wait_for_timeout(200)
    banner = pg.inner_text(".own-banner")
    check("owner banner text", ("This is what " + owner + " sees. Owners only see their own units.") in banner, banner)
    body = pg.inner_text("#v-owners")
    check("owner view hides brokerage/mandate", "Brokerage" not in body and "Mandate" not in body and pg.locator(".own-internal").count() == 0)
    others = pg.evaluate("(o)=>[...new Set(LC.state.units.map(u=>u.owner_name))].filter(n=>n!==o)", owner)
    check("owner view names no other owner", not any(n in body for n in others), [n for n in others if n in body])
    check("owner view has no owner dropdown or all-owners table", pg.locator("#own-pick").count() == 0 and pg.locator("#own-data table.tbl").count() == 0)
    nunits = pg.evaluate("(o)=>LC.state.units.filter(u=>u.owner_name===o).length", owner)
    check("one report card per unit", pg.locator("article.report").count() == nunits, pg.locator("article.report").count())
    pg.screenshot(path=f"{shots}/owners-owner-full.png", full_page=True)

    # whatsapp
    for lang in ["Odia", "Hindi", "English"]:
        pg.select_option("#own-lang", lang); pg.wait_for_timeout(100)
        txt = pg.inner_text(".own-wa .bub.in")
        check("wa preview " + lang, len(txt) > 100)
    log0 = pg.evaluate("LC.state.activity.length")
    pg.click("[data-act=send]"); pg.wait_for_timeout(150)
    check("send toast", "Report sent on WhatsApp to " + owner + " (simulated)" in pg.inner_text("#toast-root"), pg.inner_text("#toast-root"))
    check("send logged", pg.evaluate("LC.state.activity[0].text.indexOf('Weekly report sent')===0"))

    # chat
    qs = [c.get_attribute("data-q") for c in pg.locator("[data-act=ask]").all()]
    check("6 suggested questions", len(qs) == 6, qs)
    for q in qs:
        pg.click(f"[data-act=ask][data-q=\"{q}\"]"); pg.wait_for_timeout(120)
        last = pg.locator("#own-chat-body .msg.ai").last
        t = last.inner_text()
        check("answer has source footer: " + q, last.locator(".src").count() == 1, t[:200])
    foreign = pg.evaluate("(o)=>{const u=LC.state.units.find(x=>x.owner_name!==o);return u}", owner)
    pg.fill("#own-q", "What is the rent of " + foreign["unit_id"] + "?"); pg.press("#own-q", "Enter"); pg.wait_for_timeout(120)
    check("foreign unit id refused", "You can only see your own units." in pg.locator("#own-chat-body .msg.ai").last.inner_text())
    pg.fill("#own-q", "How is " + foreign["building_name"] + " doing?"); pg.press("#own-q", "Enter"); pg.wait_for_timeout(120)
    mine_b = pg.evaluate("(o)=>LC.state.units.filter(u=>u.owner_name===o).map(u=>u.building_name)", owner)
    if foreign["building_name"] not in mine_b:
        check("foreign building refused", "You can only see your own units." in pg.locator("#own-chat-body .msg.ai").last.inner_text())
    pg.fill("#own-q", "Tell me about the weather"); pg.press("#own-q", "Enter"); pg.wait_for_timeout(120)
    lt = pg.locator("#own-chat-body .msg.ai").last.inner_text()
    check("fallback passes to agent", "I can't answer that from your unit's data. I've passed your question to" in lt, lt)
    pg.screenshot(path=f"{shots}/owners-chat.png", full_page=True)
    # leak check: chat transcript must not contain any other owner's unit ids
    chat = pg.inner_text("#own-chat-body")
    mine_ids = pg.evaluate("(o)=>LC.state.units.filter(u=>u.owner_name===o).map(u=>u.unit_id)", owner)
    import re
    leak = [i for i in re.findall(r"LC-\d{3}", chat) if i not in mine_ids and i != foreign["unit_id"]]
    check("no other unit ids in chat", not leak, leak)

    # availability 1/2/3 on three different units
    ids = mine_ids
    u1, u2, u3 = ids[0], ids[1], ids[2]
    tasks0 = pg.evaluate("LC.state.tasks.length"); audit0 = pg.evaluate("LC.state.audit.length")
    # make u1 stale first so 1 shows a change
    pg.evaluate("(id)=>{const u=LC.unit(id);u.last_confirmed=LC.iso(LC.addDays(LC.today(),-9));LC.emit('units:changed')}", u1); pg.wait_for_timeout(400)
    pg.click(f"[data-act=avail][data-unit={u1}][data-n='1']"); pg.wait_for_timeout(150)
    r1 = pg.evaluate("(id)=>{const u=LC.unit(id);return [u.last_confirmed===LC.iso(LC.today()),u.confirmed_via]}", u1)
    check("reply 1 confirms today via WhatsApp reply", r1 == [True, "WhatsApp reply"], r1)
    pg.click(f"[data-act=avail][data-unit={u2}][data-n='2']"); pg.wait_for_timeout(150)
    t = pg.evaluate("(id)=>LC.state.tasks.filter(t=>t.unitId===id&&t.type==='Owner check'&&t.priority==='High'&&!t.done).length>0", u2)
    check("reply 2 creates High Owner check task", t)
    pg.click(f"[data-act=avail][data-unit={u3}][data-n='3']"); pg.wait_for_timeout(150)
    check("reply 3 marks Leased", pg.evaluate("(id)=>LC.unit(id).status", u3) == "Leased")
    check("audit grew", pg.evaluate("LC.state.audit.length") >= audit0 + 3)
    check("tasks grew", pg.evaluate("LC.state.tasks.length") > tasks0)
    pg.screenshot(path=f"{shots}/owners-after-replies.png", full_page=True)

    # ---------- settings ----------
    pg.evaluate("location.hash='settings'"); pg.wait_for_timeout(500)
    for tab in ["areas", "sources", "handoff", "team", "templates", "consent", "audit", "integrations"]:
        pg.click(f"[data-tab={tab}]"); pg.wait_for_timeout(150)
        check("tab renders " + tab, len(pg.inner_text("#st-body")) > 80)
        pg.screenshot(path=f"{shots}/settings-{tab}.png", full_page=True)
    pg.click("[data-tab=audit]")
    at = pg.inner_text("#st-body")
    check("audit shows owner replies", "WhatsApp reply" in at and "Leased" in at)
    pg.click("[data-tab=handoff]")
    before = pg.evaluate("LC.state.settings.handoffRules[0].on")
    evs = pg.evaluate("window.__se=0;LC.on('settings:changed',()=>window.__se++);0")
    pg.locator("[data-rule=H1]").uncheck(); pg.wait_for_timeout(150)
    check("rule toggle mutates on", pg.evaluate("LC.state.settings.handoffRules[0].on") == (not before) and pg.evaluate("window.__se") >= 1)
    check("Saved toast", "Saved" in pg.inner_text("#toast-root"))
    pg.locator("[data-rule=H1]").check()
    pg.fill("#st-n-slaMinutes", "20"); pg.press("#st-n-slaMinutes", "Tab"); pg.wait_for_timeout(100)
    check("SLA saved", pg.evaluate("LC.state.settings.slaMinutes") == 20)
    pg.fill("#st-n-slaMinutes", "-4"); pg.press("#st-n-slaMinutes", "Tab"); pg.wait_for_timeout(100)
    check("bad SLA rejected", pg.evaluate("LC.state.settings.slaMinutes") == 20)
    pg.fill("#st-n-largeDealSqft", "6000"); pg.press("#st-n-largeDealSqft", "Tab"); pg.wait_for_timeout(100)
    check("H5 text follows number", "6,000" in pg.evaluate("LC.state.settings.handoffRules.find(r=>r.id==='H5').trigger"))
    pg.fill("#st-n-slaMinutes", "15"); pg.press("#st-n-slaMinutes", "Tab")
    pg.fill("#st-n-largeDealSqft", "5000"); pg.press("#st-n-largeDealSqft", "Tab")
    # languages
    pg.click("[data-tab=areas]")
    pg.locator("[data-lang=Hindi]").uncheck(); pg.wait_for_timeout(150)
    check("language off stored", pg.evaluate("LC.state.settings.languages.Hindi") is False)
    pg.locator("[data-lang=Hindi]").check()
    # add area
    pg.fill("#st-an", "Sundarpada"); pg.fill("#st-ac", "Bhubaneswar"); pg.fill("#st-alat", "20.2400"); pg.fill("#st-alng", "85.7900"); pg.fill("#st-aal", "sundar pada, ring road")
    pg.click("#st-area-form button[type=submit]"); pg.wait_for_timeout(200)
    r = pg.evaluate("LC.parseRequirement('office in Sundarpada')")
    check("parser picks up new area", r["req"]["localities"] == ["Sundarpada"] and r["req"]["city"] == "Bhubaneswar", r["req"]["localities"])
    r2 = pg.evaluate("LC.parseRequirement('need an office near ring road')")
    check("alias picks up new area", r2["req"]["localities"] == ["Sundarpada"])
    check("match runs with new area", pg.evaluate("(()=>{const q=LC.parseRequirement('office in Sundarpada 2000 sqft');return LC.match(q.req).considered>0})()"))
    check("new area listed", "Sundarpada" in pg.inner_text("#st-body"))
    # duplicate + bad input
    pg.fill("#st-an", "sundarpada"); pg.fill("#st-ac", "Bhubaneswar"); pg.fill("#st-alat", "20.2"); pg.fill("#st-alng", "85.7")
    pg.click("#st-area-form button[type=submit]"); pg.wait_for_timeout(100)
    check("duplicate area rejected", "already in the list" in pg.inner_text("#st-area-msg"))
    # new city
    pg.fill("#st-an", "Sambalpur Town"); pg.fill("#st-ac", "Sambalpur"); pg.fill("#st-alat", "21.47"); pg.fill("#st-alng", "83.97"); pg.fill("#st-aal", "")
    pg.click("#st-area-form button[type=submit]"); pg.wait_for_timeout(150)
    r3 = pg.evaluate("LC.parseRequirement('shop in Sambalpur')")
    check("new city understood", r3["req"]["city"] == "Sambalpur", r3["req"]["city"])
    pg.screenshot(path=f"{shots}/settings-areas-added.png", full_page=True)

    # live refresh while visible: change units from outside
    pg.click("[data-tab=audit]")
    pg.evaluate("LC.state.audit.unshift({ts:Date.now(),unitId:'LC-001',field:'rent_per_sqft',from:'58',to:'60',by:'test'});LC.emit('units:changed')"); pg.wait_for_timeout(600)
    check("audit live refresh", "rent_per_sqft" in pg.inner_text("#st-body"))

    # dark + phone passes
    pg.evaluate("location.hash='owners'"); pg.wait_for_timeout(300)
    check("page errors none", not errs, errs)
    pg2 = b.new_page(viewport={"width": 390, "height": 844}); pg2.add_init_script('window.__LC_SKIP_LOGIN = true')
    pg2.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg2.goto("file://" + os.path.abspath(html)); pg2.wait_for_timeout(500)
    for v in ["owners", "settings"]:
        pg2.evaluate(f"location.hash='{v}'"); pg2.wait_for_timeout(400)
        if v == "owners":
            pg2.click("[data-act=mode][data-v=owner]"); pg2.wait_for_timeout(200)
        for tab in (["areas", "handoff", "templates", "audit"] if v == "settings" else [None]):
            if tab: pg2.click(f"[data-tab={tab}]"); pg2.wait_for_timeout(200)
            ov = pg2.evaluate("document.documentElement.scrollWidth - innerWidth")
            check(f"phone overflow {v} {tab or ''} = {ov}", ov <= 0)
            pg2.screenshot(path=f"{shots}/phone-{v}-{tab or 'main'}.png", full_page=True)
    check("phone errors none", not errs, errs)
    b.close()
print("FAILS:", fails if fails else "none")
