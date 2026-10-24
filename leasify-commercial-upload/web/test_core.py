import json, sys
from playwright.sync_api import sync_playwright
f = "file:///home/claude/demo/dist/Leasify_Commercial_Demo.html"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.add_init_script('window.__LC_SKIP_LOGIN = true')
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console." + m.type + ": " + m.text) if m.type in ("error",) else None)
    pg.goto(f); pg.wait_for_timeout(800)
    r = pg.evaluate("""() => {
      const out = {};
      out.units = LC.state.units.length; out.clients = LC.state.clients.length; out.visits = LC.state.visits.length; out.tasks = LC.state.tasks.length;
      out.stages = Object.fromEntries(Object.entries(LC.groupBy(LC.state.clients, c=>c.stage)).map(([k,v])=>[k,v.length]));
      const tests = [
        'Hi, I am Amit from Finlogic IT Services. Need 2500 sq ft office in Patia, budget 70 per sq ft, move in by December, plug and play, 4 car parking',
        'dukan chahiye janpath main road 500 sqft 1.2 lakh mahina',
        'Looking for a godown near Trisulia 20000-25000 sqft, 32 ft height, need power backup, immediately',
        'restaurant space in Puri near the temple, ground floor, budget 3 lakh per month, around 2000 sqft',
        'clinic Cuttack 1500 sqft ₹65/sqft next month',
        'team of 12, need coworking seats in Patia',
      ];
      out.parse = tests.map(t => { const p = LC.parseRequirement(t); const m = LC.match(p.req, {limit:3});
        return {t: t.slice(0,40), summary: LC.reqSummary(p.req), missing: p.missing, intents: Object.keys(p.intents).filter(k=>p.intents[k]),
          exact: m.exact.map(x=>x.u.unit_id+':'+x.score), close: m.close.map(x=>x.u.unit_id+':'+x.missed.map(z=>z.key).join('+')), excluded: m.excluded}; });
      out.intent = LC.parseRequirement('can you reduce the rent a bit? also call me').intents;
      out.ctxSize = LC.reqSummary(LC.parseRequirement('2000-3000', null, {expect:'size'}).req);
      out.ctxBud = LC.reqSummary(LC.parseRequirement('60', null, {expect:'budget'}).req);
      out.funnel = LC.funnel();
      return out;
    }""")
    print(json.dumps(r, indent=1, ensure_ascii=False)); print("ERRORS:", errs)
    b.close()
