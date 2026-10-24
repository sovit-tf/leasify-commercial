"""Click-through for crm.js: python3 test_crm_flow.py dist/t-crm.html"""
import sys, os, json
from playwright.sync_api import sync_playwright
html = sys.argv[1]; shots = "/home/claude/demo/shots/crm"; os.makedirs(shots, exist_ok=True)
fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" " + str(extra) if extra and not cond else ""))
    if not cond: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 900}); pg.add_init_script('window.__LC_SKIP_LOGIN = true')
    errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.abspath(html)); pg.wait_for_timeout(500)
    # stub the copilot term sheet so the button can be exercised
    pg.evaluate("LC.draftTermSheet = (u, c) => 'TERM SHEET for ' + u")
    pg.evaluate("location.hash='crm'"); pg.wait_for_timeout(500)
    check("board has 8 columns", pg.locator(".crm-col").count() == 8)
    check("lost collapsed", pg.locator(".crm-col.collapsed").count() == 1)
    check("5 kpis", pg.locator("#crm-kpis .kpi").count() == 5)
    # filter + list view
    pg.click("[data-view=list]"); pg.wait_for_timeout(200)
    check("list rows", pg.locator("table.tbl tbody tr").count() > 50)
    pg.select_option("#crm-f-stage", "Proposal"); pg.wait_for_timeout(200)
    n = pg.locator("table.tbl tbody tr").count(); check("stage filter", 0 < n < 20, n)
    pg.select_option("#crm-sort", "followup"); pg.wait_for_timeout(100)
    pg.click("#crm-clear"); pg.click("[data-view=board]"); pg.wait_for_timeout(200)
    pg.fill("#crm-q", "zzzz"); pg.wait_for_timeout(200)
    check("search no match", pg.locator(".crm-card").count() == 0)
    pg.fill("#crm-q", ""); pg.wait_for_timeout(200)
    # open client with reqHistory
    cid = pg.evaluate("LC.state.clients.find(c => c.reqHistory.length && c.timeline.length > 3 && !['Lost'].includes(c.stage)).id")
    name = pg.evaluate(f"LC.crm.get('{cid}').company")
    pg.fill("#crm-q", name); pg.wait_for_timeout(250)
    pg.locator(f".crm-card[data-id='{cid}'] b").first.click(); pg.wait_for_timeout(300)
    check("drawer opens", pg.locator(".drawer.wide").count() == 1)
    for tab in ["overview", "requirement", "movement", "units", "timeline", "tasks"]:
        pg.click(f"#ct-{tab}"); pg.wait_for_timeout(150)
        txt = pg.inner_text(".drawer-b")
        ok = {"overview": "Quick actions" in txt and "Book a visit" in txt and "Draft term sheet" in txt,
              "requirement": "Requirement history" in txt and "→" in txt and "Edit in Requirement match" in txt,
              "movement": "Stage history" in txt and "What each stage means" in txt and "from enquiry" in txt,
              "units": "Best matches now" in txt and "Units shared" in txt,
              "timeline": "Add to timeline" in txt,
              "tasks": "Add a task" in txt}[tab]
        check("tab " + tab, ok)
        pg.screenshot(path=f"{shots}/flow-tab-{tab}.png")
    # diff text
    pg.click("#ct-requirement"); print("DIFF:", pg.inner_text(".crm-diff").replace("\n", " | "))
    # overview actions
    pg.click("#ct-overview")
    pg.click("[data-act=term]"); pg.wait_for_timeout(150)
    check("term sheet shown", "TERM SHEET for" in pg.inner_text(".drawer-b"))
    ag = pg.evaluate(f"LC.crm.get('{cid}').agent")
    other = pg.evaluate(f"LC.TEAM.find(t => t.name !== LC.crm.get('{cid}').agent).name")
    pg.select_option("#ov-agent", other); pg.wait_for_timeout(250)
    check("reassigned", pg.evaluate(f"LC.crm.get('{cid}').agent") == other)
    pg.fill("#ov-fu", "2026-11-20"); pg.click("#ov-fu-save"); pg.wait_for_timeout(200)
    check("follow-up saved", pg.evaluate(f"LC.iso(LC.crm.get('{cid}').nextFollowUp)") == "2026-11-20")
    # timeline note
    pg.click("#ct-timeline"); pg.fill("#tl-text", "Spoke to the director, wants a second visit")
    pg.select_option("#tl-type", "Call"); pg.click("#tl-form button[type=submit]"); pg.wait_for_timeout(250)
    check("timeline note added", "Spoke to the director" in pg.inner_text(".crm-tl") and pg.evaluate(f"LC.crm.get('{cid}').timeline[0].type") == "call")
    # tasks
    pg.click("#ct-tasks"); pg.fill("#tk-title", "Send floor plan"); pg.click("#tk-form button[type=submit]"); pg.wait_for_timeout(250)
    check("task added", "Send floor plan" in pg.inner_text(".drawer-b"))
    pg.locator("[data-done]").first.click(); pg.wait_for_timeout(250)
    # share from units tab
    pg.click("#ct-units"); sh = pg.locator("[data-share]")
    if sh.count():
        sh.first.click(); pg.wait_for_timeout(250); check("share", "Shared" in pg.inner_text(".drawer-b"))
    # book a visit from units tab/quick action
    pg.click("#ct-overview"); pg.click("[data-act=visit]"); pg.wait_for_timeout(250)
    before = pg.evaluate("LC.state.visits.length")
    pg.locator("#bv-unit").select_option(index=1); pg.wait_for_timeout(150)
    pg.locator("[data-slot]").first.click(); pg.wait_for_timeout(100)
    pg.screenshot(path=f"{shots}/flow-book.png")
    pg.click("#bv-book"); pg.wait_for_timeout(300)
    check("visit booked", pg.evaluate("LC.state.visits.length") == before + 1)
    check("toast text", "A confirmation call is on" in pg.inner_text("#toast-root"), pg.inner_text("#toast-root"))
    check("returned to client drawer", pg.locator(".drawer.wide").count() == 1)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    # move a card to Proposal with the select
    pg.fill("#crm-q", ""); pg.wait_for_timeout(200)
    qid = pg.evaluate("LC.state.clients.find(c => c.stage === 'Qualified').id")
    pg.locator(f".crm-card[data-id='{qid}'] select").select_option("Proposal"); pg.wait_for_timeout(300)
    check("moved to Proposal", pg.evaluate(f"LC.crm.get('{qid}').stage") == "Proposal")
    check("card now in Proposal column", pg.locator(f".crm-col[data-stage='Proposal'] .crm-card[data-id='{qid}']").count() == 1)
    # drag and drop
    did = pg.evaluate("LC.state.clients.find(c => c.stage === 'New enquiry').id")
    pg.drag_and_drop(f".crm-card[data-id='{did}']", ".crm-col[data-stage='Qualified'] .crm-col-h"); pg.wait_for_timeout(300)
    check("drag and drop", pg.evaluate(f"LC.crm.get('{did}').stage") == "Qualified")
    # lost with reason (select)
    lid = pg.evaluate("LC.state.clients.find(c => c.stage === 'Site visit').id")
    pg.locator(f".crm-card[data-id='{lid}'] select").select_option("Lost"); pg.wait_for_timeout(200)
    check("lost asks reason", pg.locator(f".crm-card[data-id='{lid}'] [data-lost-reason]").count() == 1)
    pg.screenshot(path=f"{shots}/flow-lost.png")
    pg.locator(f".crm-card[data-id='{lid}'] [data-lost-reason]").select_option("Requirement on hold")
    pg.locator(f".crm-card[data-id='{lid}'] [data-lost-ok]").click(); pg.wait_for_timeout(300)
    check("lost saved", pg.evaluate(f"LC.crm.get('{lid}').stage + '|' + LC.crm.get('{lid}').lostReason") == "Lost|Requirement on hold")
    pg.click("[data-lost-toggle]"); pg.wait_for_timeout(200)
    check("lost column expands", pg.locator(".crm-col[data-stage='Lost'] .crm-card").count() > 5)
    # add client
    pg.click("#crm-add"); pg.wait_for_timeout(200)
    ph = pg.evaluate("LC.state.clients.find(c => !['Lost','Signed lease'].includes(c.stage)).phone")
    cmp_ = pg.evaluate("(()=>{const c=LC.state.clients.find(c => !['Lost','Signed lease'].includes(c.stage)); return c.company})()")
    pg.fill("#ac-phone", ph); pg.wait_for_timeout(100)
    check("duplicate phone warning", "Rule H9 routes it to their agent" in pg.inner_text("#ac-dup"))
    pg.fill("#ac-phone", "+91 90000 11111"); pg.fill("#ac-name", "Test Person")
    pg.fill("#ac-text", "Need 2500 sq ft office in Patia, budget 70 per sq ft, move in by December, 4 car parking"); pg.click("#ac-parse"); pg.wait_for_timeout(150)
    check("requirement parsed", "Patia" in pg.inner_text("#ac-found"))
    n0 = pg.evaluate("LC.state.clients.length")
    pg.screenshot(path=f"{shots}/flow-add.png")
    pg.click("#ac-form button[type=submit]"); pg.wait_for_timeout(400)
    check("client added", pg.evaluate("LC.state.clients.length") == n0 + 1)
    check("new client qualified + drawer", pg.evaluate("LC.state.clients[0].stage") == "Qualified" and pg.locator(".drawer.wide").count() == 1)
    pg.keyboard.press("Escape")
    # ------- visits view
    pg.evaluate("location.hash='visits'"); pg.wait_for_timeout(500)
    check("visits kpis", pg.locator("#vs-kpis .kpi").count() == 5)
    vid = pg.evaluate("LC.state.visits.find(v => v.status === 'Booked' && v.when > Date.now() && v.confirmation === 'Pending').id")
    pg.locator(f"[data-vid='{vid}'] [data-a=confirm]").click(); pg.wait_for_timeout(250)
    check("confirmed on call", pg.evaluate(f"LC.visits.get('{vid}').confirmation") == "Confirmed")
    # mark done with feedback -> proposal
    vid2 = pg.evaluate("(()=>{const v = LC.state.visits.find(v => v.status === 'Booked' && ['Qualified','Site visit','New enquiry'].includes(LC.crm.get(v.clientId).stage)); return v ? v.id : null})()")
    check("have a booked visit to complete", bool(vid2))
    cl2 = pg.evaluate(f"LC.visits.get('{vid2}').clientId")
    pg.locator(f"[data-vid='{vid2}'] [data-a=done]").click(); pg.wait_for_timeout(200)
    pg.fill(f"#df-fb-{vid2}", "Liked the frontage, wants the proposal this week"); pg.select_option(f"#df-r-{vid2}", "5"); pg.select_option(f"#df-n-{vid2}", "Send proposal")
    pg.screenshot(path=f"{shots}/flow-done.png")
    pg.locator(f"[data-doneform='{vid2}'] button[type=submit]").click(); pg.wait_for_timeout(300)
    res = pg.evaluate(f"({{s: LC.visits.get('{vid2}').status, r: LC.visits.get('{vid2}').rating, f: LC.visits.get('{vid2}').feedback, st: LC.crm.get('{cl2}').stage}})")
    check("visit done + client to Proposal", res["s"] == "Done" and res["r"] == 5 and res["st"] == "Proposal", res)
    # no-show, reschedule, cancel
    vid3 = pg.evaluate("LC.state.visits.find(v => v.status === 'Booked').id")
    pg.locator(f"[data-vid='{vid3}'] [data-a=resched]").click(); pg.wait_for_timeout(250)
    pg.locator("[data-slot]").first.click(); b0 = pg.evaluate("LC.state.visits.length"); pg.click("#bv-book"); pg.wait_for_timeout(300)
    check("reschedule books new and cancels old", pg.evaluate("LC.state.visits.length") == b0 + 1 and pg.evaluate(f"LC.visits.get('{vid3}').status") == "Cancelled")
    vid4 = pg.evaluate("LC.state.visits.find(v => v.status === 'Booked').id")
    pg.locator(f"[data-vid='{vid4}'] [data-a=noshow]").click(); pg.wait_for_timeout(250)
    check("no-show", pg.evaluate(f"LC.visits.get('{vid4}').status") == "No-show")
    vid5 = pg.evaluate("LC.state.visits.find(v => v.status === 'Booked').id")
    pg.locator(f"[data-vid='{vid5}'] [data-a=cancel]").click(); pg.locator(f"[data-vid='{vid5}'] [data-a=cancel-yes]").click(); pg.wait_for_timeout(250)
    check("cancel", pg.evaluate(f"LC.visits.get('{vid5}').status") == "Cancelled")
    pg.click("[data-range=past]"); pg.wait_for_timeout(200); check("past agenda shows rows", pg.locator(".vs-row").count() > 0)
    pg.click("[data-range=up]")
    pg.uncheck("#vs-mine"); pg.wait_for_timeout(200)
    t = pg.locator("[data-task]").first
    if t.count():
        n = pg.evaluate("LC.tasks.open().length"); t.click(); pg.wait_for_timeout(250); check("task complete", pg.evaluate("LC.tasks.open().length") < n)
    pg.screenshot(path=f"{shots}/flow-visits.png")
    print("errors:", errs or "none")
    check("no page errors", not errs)
    # phone widths
    pg.set_viewport_size({"width": 390, "height": 844})
    for v in ["crm", "visits"]:
        pg.evaluate(f"location.hash='{v}'"); pg.wait_for_timeout(400)
        check(f"phone overflow {v}", pg.evaluate("document.documentElement.scrollWidth - innerWidth") == 0)
    pg.evaluate("location.hash='crm'"); pg.wait_for_timeout(300)
    pg.evaluate(f"LC.openClient('{cid}')"); pg.wait_for_timeout(300)
    for tab in ["overview", "requirement", "movement", "units", "timeline", "tasks"]:
        pg.click(f"#ct-{tab}"); pg.wait_for_timeout(120)
        ov = pg.evaluate("(()=>{const d=document.querySelector('.drawer-b'); return d.scrollWidth - d.clientWidth})()")
        check(f"phone drawer {tab} overflow", ov <= 0, ov)
        if tab in ("overview", "movement"): pg.screenshot(path=f"{shots}/phone-drawer-{tab}.png")
    b.close()
print("FAILS:", fails or "none")
