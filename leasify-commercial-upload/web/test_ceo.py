"""CEO co-pilot: ask every suggested question plus extra phrasings, check none fall back, print first line of each, screenshot some."""
import sys, os, json, re
from playwright.sync_api import sync_playwright
html = sys.argv[1] if len(sys.argv) > 1 else "dist/Leasify_Commercial_Demo.html"
shots = "shots/ceo"; os.makedirs(shots, exist_ok=True)
EXTRA = [
 ("how's the business doing?", "brief"), ("show me the monthly numbers", "brief"), ("How are we doing vs last month?", "brief"),
 ("revenue last month", "revenue"), ("How much brokerage did we make this week?", "revenue"),
 ("how much money will we make soon", "forecast"), ("Give me a 60 day projection", "forecast"),
 ("which deals are worth the most", "deals"), ("show top deals", "deals"),
 ("who is our top agent", "team"), ("Show me the team scorecard", "team"), ("How is Priyanka doing?", "team"), ("which agent needs coaching", "team"),
 ("where do our leads come from", "sources"), ("Is 99acres worth paying for?", "sources"),
 ("why are we not closing deals", "lost"), ("What are the main reasons we lose clients?", "lost"),
 ("what do customers want that we lack", "demand"), ("Where is demand higher than supply?", "demand"),
 ("which listings are sitting empty", "stuck_inventory"), ("Which units have been vacant the longest?", "stuck_inventory"),
 ("how quickly do we answer enquiries", "speed"), ("What is our no-show rate?", "speed"),
 ("any owners not replying", "health"), ("How many units are flagged or stale?", "health"),
 ("list my top priorities", "focus"), ("What needs my attention today?", "focus"),
 ("what can you do", "help"), ("landlords who give us the most deals", "owners"), ("Which owners have exclusive mandates?", "owners"),
 ("Compare this week with last week", "compare"), ("Are we doing better than last month?", "brief"),
]
SUG_EXPECT = {
 "What brokerage did we earn this month?": "revenue", "What's the forecast for the next 90 days?": "forecast", "Compare this month with last month": "compare", "How are we doing this week?": "brief",
 "What are the biggest deals in the pipeline?": "deals", "Which lead source should I spend more on?": "sources", "Which big deals are stuck?": "stuck_deals",
 "Who's performing best?": "team", "How is Ananya doing?": "team", "Are we replying fast enough?": "speed",
 "What are occupiers asking for that we don't have?": "demand", "Which units should we push?": "stuck_inventory", "Is our inventory up to date?": "health", "Which owners bring us the most business?": "owners",
 "Where are we losing deals?": "lost", "What are the biggest risks right now?": "focus", "What should I focus on this week?": "focus", "What can you answer?": "help",
}
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for vp, tag in [({"width": 1400, "height": 900}, "desk"), ({"width": 390, "height": 844}, "phone")]:
        pg = b.new_page(viewport=vp, color_scheme="light"); pg.add_init_script('window.__LC_SKIP_LOGIN = true')
        errs = []
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" else None)
        pg.goto("file://" + os.path.abspath(html)); pg.wait_for_timeout(500)
        pg.evaluate("location.hash='ceo'"); pg.wait_for_timeout(600)
        sugg = pg.evaluate("Array.from(document.querySelectorAll('.ceo-sug .chip')).map(b=>b.dataset.ask)")
        qs = [(q, SUG_EXPECT.get(q)) for q in sugg] + EXTRA
        if tag == "phone": qs = qs[:6]
        print(f"=== {tag}: {len(sugg)} suggested + {len(EXTRA)} extra")
        for i, (q, exp) in enumerate(qs):
            pg.evaluate("q => LC.ceo.ask(q)", q); pg.wait_for_timeout(120)
            r = pg.evaluate("""() => { const m = document.querySelector('#ceo-body .msg.ai:last-child'); return {intent: m.dataset.intent, lead: m.querySelector('p') ? m.querySelector('p').textContent : '', text: m.textContent, src: !!m.querySelector('.src')}; }""")
            flags = []
            if r["intent"] == "fallback": flags.append("FALLBACK")
            if exp and r["intent"] != exp: flags.append(f"expected {exp}")
            if re.search(r"NaN|undefined|null|Infinity", r["text"]): flags.append("BAD TOKEN")
            if "—" in r["text"]: flags.append("EM-DASH")
            if re.search(r"homeeasy", r["text"], re.I): flags.append("HOMEEASY")
            if not r["src"]: flags.append("no source footer")
            if flags: bad += 1
            print(f"[{r['intent']}] {q}\n    {r['lead'][:230]}" + (("\n    !! " + ", ".join(flags)) if flags else ""))
        if tag == "desk":
            for intent in ["demand", "deals", "team", "forecast", "focus", "revenue", "sources", "lost"]:
                q = {"demand": "What are occupiers asking for that we don't have?", "deals": "What are the biggest deals in the pipeline?", "team": "Who's performing best?", "forecast": "What's the forecast for the next 90 days?", "focus": "What should I focus on this week?", "revenue": "What brokerage did we earn this month?", "sources": "Which lead source should I spend more on?", "lost": "Where are we losing deals?"}[intent]
                pg.evaluate("q => LC.ceo.ask(q)", q); pg.wait_for_timeout(120)
                pg.evaluate("() => { const m = document.querySelector('#ceo-body .msg.ai:last-child'); m.scrollIntoView({block:'start'}); document.querySelector('.ceo-chat').scrollIntoView({block:'center'}); }"); pg.wait_for_timeout(150)
                pg.locator(".ceo-chat").screenshot(path=f"{shots}/ans-{tag}-{intent}.png")
        else:
            for intent, q in [("demand", "What are occupiers asking for that we don't have?"), ("deals", "What are the biggest deals in the pipeline?"), ("focus", "What should I focus on this week?"), ("team", "Who's performing best?")]:
                pg.evaluate("q => LC.ceo.ask(q)", q); pg.wait_for_timeout(120)
                pg.locator(".ceo-chat").screenshot(path=f"{shots}/ans-{tag}-{intent}.png")
            pg.screenshot(path=f"{shots}/phone-chat.png", full_page=False)
            print("phone overflow:", pg.evaluate("document.documentElement.scrollWidth - window.innerWidth"))
        pg.screenshot(path=f"{shots}/after-{tag}.png", full_page=True) if tag == "desk" else None
        print(f"[{tag}] errors:", errs or "none")
        pg.close()
    b.close()
print("flagged:", bad)
