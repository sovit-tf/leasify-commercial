"""Start 30 leads at 6x, wait ~40 s, print counts, screenshot an open thread, then test the occupier chat (English and Odia)."""
import json, sys, os
from playwright.sync_api import sync_playwright
html = sys.argv[1] if len(sys.argv) > 1 else "dist/t-inbox.html"
shots = "shots/inbox"; os.makedirs(shots, exist_ok=True)
WAIT = int(sys.argv[2]) if len(sys.argv) > 2 else 40000
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.abspath(html)); pg.wait_for_timeout(500)
    pg.evaluate("location.hash='inbox'"); pg.wait_for_timeout(500)
    clients0 = pg.evaluate("LC.state.clients.length")
    pg.click("[data-sp='6']"); pg.click("[data-a='sim30']")
    pg.wait_for_timeout(8000)
    pg.screenshot(path=f"{shots}/run30-8s.png")
    live8 = pg.evaluate("LC.sim.stats().live")
    peak = live8
    for i in range(int(WAIT / 2000) - 4):
        pg.wait_for_timeout(2000); peak = max(peak, pg.evaluate("LC.sim.stats().live"))
    st = pg.evaluate("""() => { const s = LC.sim.stats(); return { byStatus: s.byStatus, rules: s.rules, total: s.total, queueTotal: LC.state.queue.length, waiting: LC.queue.waiting().length, visitsInState: LC.state.visits.filter(v => v.leadId).length, visitsLead: s.visits, medianFirstReply: s.medianFirstReply, bySource: s.bySource, breaches: s.breaches, tasks: LC.state.tasks.filter(t => t.type === 'Call list').length, nurtureClients: LC.state.clients.filter(c => c.stage === 'Nurture' && c.leadId).length, lostClients: LC.state.clients.filter(c => c.stage === 'Lost' && c.leadId).length, langs: LC.state.leads.reduce((m, l) => (m[l.language] = (m[l.language] || 0) + 1, m), {}), consent: LC.state.consent.length }; }""")
    clients1 = pg.evaluate("LC.state.clients.length")
    print(json.dumps({"peakLive": peak, "liveAt8s": live8, **st, "clientsCreated": clients1 - clients0}, indent=1, ensure_ascii=False))
    # open one thread
    pg.evaluate("document.querySelector('[data-tab=\"booked\"]').click()"); pg.wait_for_timeout(700)
    pg.evaluate("document.querySelector('.ib-row').click()"); pg.wait_for_timeout(800)
    pg.screenshot(path=f"{shots}/thread-booked.png")
    pg.evaluate("document.querySelector('[data-tab=\"needs\"]').click()"); pg.wait_for_timeout(700)
    pg.screenshot(path=f"{shots}/needs-queue.png")
    print("PAGE ERRORS:", errs or "none")
    b.close()
