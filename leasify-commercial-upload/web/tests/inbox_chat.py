"""Chat in the 'Test as an occupier' phone: one full English conversation and one Odia conversation, each to a booked visit."""
import json, sys, os
from playwright.sync_api import sync_playwright
html = sys.argv[1] if len(sys.argv) > 1 else "dist/t-inbox.html"
shots = "shots/inbox"; os.makedirs(shots, exist_ok=True)

def run(pg, source, lang, tag):
    pg.evaluate("document.querySelector('[data-a=\"test\"]').click()"); pg.wait_for_timeout(400)
    pg.select_option("#tp-src", source); pg.select_option("#tp-lang", lang); pg.wait_for_timeout(200)
    first = pg.input_value("#tp-first")
    pg.screenshot(path=f"{shots}/chat-{tag}-setup.png")
    pg.click("#tp-start")
    transcript = []
    for step in range(30):
        pg.wait_for_timeout(2600)
        st = pg.evaluate("""() => { const l = LC.state.leads.find(x => x._test && x.id === (window.__ibTest && 0 || x.id)); const L = LC.state.leads.filter(x=>x._test); const lead = L[L.length-1]; return { status: lead.status, stage: lead._e.stage, expect: lead._e.expect, typing: lead._typing, n: lead.messages.length, id: lead.id }; }""")
        if st["status"] in ("booked", "handoff", "closed", "nurture"): break
        if st["typing"]: continue
        # choose the next input like an occupier would
        act = pg.evaluate("""() => { const q = document.querySelectorAll('#ph-quick [data-pq]'); if (q.length) return {kind:'quick', text: q[0].dataset.pq}; const c = document.querySelector('#ph-sug .chip'); const first = c ? c.dataset.pq : null; return {kind:'chip', text: first}; }""")
        if act["kind"] == "quick":
            pg.click("#ph-quick [data-pq]:first-child")
        else:
            pg.click("#ph-sug .chip:first-child")
    pg.wait_for_timeout(2800)
    pg.screenshot(path=f"{shots}/chat-{tag}-end.png")
    r = pg.evaluate("""() => { const L = LC.state.leads.filter(x=>x._test); const l = L[L.length-1]; const c = LC.crm.get(l.clientId); return { status: l.status, visit: !!l.visitId, rules: l.rulesFired, lang: l.language, client: c && { stage: c.stage, agent: c.agent, req: LC.reqSummary(c.req), shared: c.shared.length, lang: c.language }, tasks: LC.state.tasks.filter(t => t.leadId === l.id || (t.visitId && t.visitId === l.visitId)).map(t => t.type), msgs: l.messages.filter(m=>m.from!=='system').map(m => m.from + ': ' + m.text.slice(0, 90)) }; }""")
    return first, r

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.abspath(html)); pg.wait_for_timeout(500)
    pg.evaluate("location.hash='inbox'"); pg.wait_for_timeout(400)
    for source, lang, tag in [("Office WhatsApp", "English", "en"), ("Magicbricks", "Odia", "od")]:
        first, r = run(pg, source, lang, tag)
        print("=====", tag, source, lang); print("first:", first[:160]); print(json.dumps(r, indent=1, ensure_ascii=False))
        pg.evaluate("LC.closeDrawer()"); pg.wait_for_timeout(300)
    print("PAGE ERRORS:", errs or "none")
    b.close()
