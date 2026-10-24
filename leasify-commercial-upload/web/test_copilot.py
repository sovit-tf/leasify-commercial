"""Co-pilot test: python3 test_copilot.py dist/t-copilot.html"""
import sys, os, json
from playwright.sync_api import sync_playwright
html = sys.argv[1]
EXTRA = [
 "Any showroom near the airport under 90 per sq ft?",
 "Which clients have gone quiet for a week?",
 "Show me everything stuck for more than 7 days",
 "Any visits today?",
 "Which units are sitting empty the longest?",
 "Tell me about LC-012",
 "Median rent for a showroom in Cuttack",
 "How many leads came from Magicbricks in the last 30 days?",
 "Rohit's open clients",
 "Which owners haven't confirmed their units?",
 "Which units were visited but never got an offer?",
 "Office space for 30 seats in Patia",
 "What did visitors say about LC-007?",
 "Show visits for this week",
 "Hello",
 "Compare LC-002 and LC-004",
 "Typical rent for warehouses in Jatni",
 "What does a clinic cost per sq ft in Bhubaneswar?",
]
SEQ = [  # follow-ups that depend on the previous answer
 ("What fits a 2,500 sq ft clinic in Patia, ready by March?", None),
 ("Compare these", None),
 ("Draft the term sheet for the first one", None),
 ("Find a 1,200 sq ft shop in Saheed Nagar", None),
 ("compare these three", None),
]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 900}); pg.add_init_script('window.__LC_SKIP_LOGIN = true')
    errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.abspath(html)); pg.wait_for_timeout(500)
    pg.evaluate("location.hash='copilot'"); pg.wait_for_timeout(500)
    bad = 0
    def last():
        return pg.evaluate("""() => { const m = [...document.querySelectorAll('#cp-body .msg.ai')].pop(); return {intent: m.dataset.intent, first: (m.querySelector('p')||m).innerText.split('\\n')[0], src: (m.querySelector('.src')||{}).innerText||''}; }""")
    def ask_chip(q):
        pg.evaluate("""(q)=>{ const b=[...document.querySelectorAll('.cp-sug .chip')].find(x=>x.dataset.ask===q); b.click(); }""", q)
        pg.wait_for_timeout(120)
    def ask_typed(q):
        pg.fill('#cp-in', q); pg.press('#cp-in', 'Enter'); pg.wait_for_timeout(120)
    def check(tag, q, r):
        global bad
        ok = r['intent'] not in ('fallback', 'thinking') and bool(r['src'])
        if r['intent'] == 'welcome': ok = False
        if '—' in r['first'] or '—' in r['src']: ok = False
        if not ok: bad += 1
        print(f"[{'ok ' if ok else 'BAD'}] {tag} {r['intent']:<11} Q: {q}\n        A: {r['first']}")
    chips = pg.evaluate("[...document.querySelectorAll('.cp-sug .chip')].map(b=>b.dataset.ask)")
    print("== suggested questions:", len(chips))
    for q in chips:
        ask_chip(q); check('chip', q, last())
    print("== extra phrasings")
    for q in EXTRA:
        ask_typed(q); check('typ', q, last())
    print("== follow-up sequence")
    for q, _ in SEQ:
        ask_typed(q); check('seq', q, last())
    # em-dash scan over all rendered text
    txt = pg.inner_text('#cp-body'); print("em-dash in chat:", '—' in txt)
    # click every action / link in chat (no module loaded: should toast, not throw)
    n = pg.evaluate("""() => { let n=0; document.querySelectorAll('#cp-body [data-act]').forEach(b=>{ const t=b.textContent; if(/Compare these|term sheet/i.test(t)) return; b.click(); n++; }); return n; }""")
    print("clicked actions:", n)
    # fallback
    ask_typed("What's the weather in Puri?"); r = last(); print("fallback ->", r['intent'], '|', r['first']); 
    if r['intent'] != 'fallback': bad += 1
    print("noted tasks:", pg.evaluate("LC.state.tasks.filter(t=>t.type==='Co-pilot question').length"))
    # Claude mock
    pg.evaluate("""() => { LC.ai.sample = async (msgs, opts) => { const names = opts.tools.map(t=>t.name); const r = await opts.tools[0].execute({requirement:'clinic in Patia'}); const c = await opts.tools[1].execute({name:'zzz'}); await opts.tools[2].execute({}); await opts.tools[3].execute({day:'week'}); await opts.tools[4].execute({}); if (opts.cache !== false) throw new Error('cache'); return {text: 'Tools: ' + names.join(', ') + ' — found ' + r.rows.length + ' rows.'}; }; }""")
    ask_typed("Is the weather nice for visits in Puri?"); pg.wait_for_timeout(300); r = last(); print("claude mock ->", r['intent'], '|', r['first']); 
    if r['intent'] != 'claude': bad += 1
    pg.evaluate("() => { LC.ai.sample = async () => { throw new Error('rate_limited'); }; }")
    ask_typed("Tell me a joke about brokers"); pg.wait_for_timeout(300); r = last(); print("claude error ->", r['intent'])
    if r['intent'] != 'fallback': bad += 1
    # mic
    pg.evaluate("window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined")
    pg.click('#cp-mic'); print("mic note:", pg.inner_text('#cp-voice-note'))
    # re-open keeps chat
    pg.evaluate("location.hash='dashboard'"); pg.wait_for_timeout(200); pg.evaluate("location.hash='copilot'"); pg.wait_for_timeout(300)
    print("messages kept after revisit:", pg.evaluate("document.querySelectorAll('#cp-body .msg').length"))
    print("page errors:", json.dumps(errs, indent=1) if errs else "none")
    print("BAD answers:", bad)
    b.close()
