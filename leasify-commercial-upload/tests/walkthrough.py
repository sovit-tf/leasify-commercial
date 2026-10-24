"""Records a narrated walkthrough video of the running app (every major screen) plus one
screenshot per step. Usage: BASE=http://localhost:3000 OUT=/path python3 tests/walkthrough.py"""
import os, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3000")
OUT = os.environ.get("OUT", "/tmp/walkthrough")
PIN = os.environ.get("DEMO_PIN", "2580")
os.makedirs(OUT, exist_ok=True)
CAP = """(t) => { let d = document.getElementById('wt-cap'); if (!d) { d = document.createElement('div'); d.id = 'wt-cap';
  d.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;background:rgba(15,23,42,.92);color:#fff;font:600 17px system-ui;padding:10px 18px;border-radius:10px;max-width:80%;text-align:center;pointer-events:none';
  document.body.appendChild(d); } d.textContent = t; }"""
n = [0]

def step(pg, text, wait=2500):
    try: pg.evaluate(CAP, text)
    except Exception: pass
    pg.wait_for_timeout(wait)
    n[0] += 1
    pg.screenshot(path=f"{OUT}/{n[0]:02d}.png")

def login(pg, name):
    pg.goto(BASE + "/"); pg.wait_for_selector("[data-key]")
    pg.locator("[data-key]", has_text=name).first.click()
    pg.fill("#au-pin", PIN); pg.click("#au-go")
    pg.wait_for_function("window.LC && LC.session && LC.session.signedIn && LC.state", timeout=20000)
    pg.wait_for_timeout(1500)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(bypass_csp=True, viewport={"width": 1440, "height": 900}, record_video_dir=OUT, record_video_size={"width": 1440, "height": 900})
    pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/"); pg.wait_for_selector("[data-key]")
    step(pg, "Sign-in: each person has a PIN. Roles are checked on the server.")
    login(pg, "Sanjeev Das")
    step(pg, "Dashboard (CEO): live numbers from the database, needs-attention list, activity feed", 3500)

    pg.evaluate("LC.go('inbox')"); pg.wait_for_selector(".ib-strip")
    pg.click('[data-sp="3"]'); pg.click('[data-a="sim30"]')
    step(pg, "Lead inbox: 30 enquiries arrive from 11 sources. The AI agent replies in about a second", 6000)
    step(pg, "English, Hindi and Odia. Handoff rules send price, legal and complaints to a person", 6000)
    target = pg.evaluate("(() => { const l = LC.state.leads.find(x => x.status === 'ai'); return l ? l.id : null; })()")
    if target:
        pg.evaluate("(id) => LC.openLead(id)", target); pg.wait_for_timeout(1200)
        step(pg, "One conversation: what the agent captured, questions asked, rules fired", 3500)
        pg.click('[data-act="take"]'); pg.wait_for_selector("#ib-msg")
        pg.fill("#ib-msg", "Hello, this is Rohit from the leasing desk. I'll call you in 10 minutes.")
        pg.press("#ib-msg", "Enter")
        step(pg, "Take over: a person types, the AI goes quiet. Hand back and it carries on", 3000)
        pg.click('[data-act="back"]')
    pg.click('[data-a="test"]'); pg.wait_for_selector("#tp-start"); pg.click("#tp-start"); pg.wait_for_timeout(2500)
    pg.fill("#ph-in", "I need an office in Patia, about 2000 sq ft, budget 70 per sq ft, move in next month")
    pg.press("#ph-in", "Enter")
    step(pg, "Test as an occupier: the same agent that answers on WhatsApp", 6000)
    pg.evaluate("LC.closeDrawer && LC.closeDrawer()")

    pg.evaluate("LC.go('inventory')"); pg.wait_for_timeout(1500)
    step(pg, "Inventory: 50 sample units, filters, freshness badges (owner confirmed in 14 days)", 3000)
    pg.evaluate("LC.openUnit && LC.openUnit('LC-001')"); pg.wait_for_timeout(1500)
    step(pg, "Listing page: price, cost calculator, clients this unit fits, visits, change history", 3500)
    pg.mouse.wheel(0, 1400); step(pg, "Cost calculator: move-in cost, total lease value, year by year", 3000)
    pg.evaluate("LC.closeDrawer && LC.closeDrawer()")

    pg.evaluate("LC.go('match')"); pg.wait_for_timeout(2000)
    step(pg, "Requirement match: paste notes or speak, fields extracted, ranked units with factor scores", 4000)

    pg.evaluate("LC.go('copilot')"); pg.wait_for_selector("#cp-in")
    pg.fill("#cp-in", "Which units have had visits but no offer?"); pg.press("#cp-in", "Enter")
    step(pg, "Leasing co-pilot: answers only from live data, with the definition behind each number", 4000)

    pg.evaluate("LC.go('crm')"); pg.wait_for_timeout(1800)
    step(pg, "CRM: every client by stage, saved on the server and shared with the team", 3000)
    cid = pg.evaluate("LC.state.clients.find(c => c.stage === 'Proposal').id")
    pg.evaluate("(id) => LC.openClient(id)", cid); pg.wait_for_timeout(1500)
    step(pg, "Client record: requirement history, days per stage, units shared, timeline", 3500)
    pg.evaluate("LC.closeDrawer && LC.closeDrawer()")

    pg.evaluate("LC.go('visits')"); pg.wait_for_timeout(1800)
    step(pg, "Site visits: agenda, confirmation calls the day before, feedback, no-shows", 3000)
    pg.evaluate("LC.go('ceo')"); pg.wait_for_timeout(2500)
    step(pg, "CEO co-pilot: weekly brief, brokerage, weighted pipeline, focus list", 3500)
    pg.evaluate("LC.go('team')"); pg.wait_for_timeout(2000)
    step(pg, "Team report cards: one score per agent from speed, follow-up, visits, conversion", 3000)
    pg.evaluate("LC.go('analytics')"); pg.wait_for_timeout(2500)
    step(pg, "Analytics: enquiries by source, funnel, speed, days vacant, lost reasons", 3000)
    pg.evaluate("LC.go('settings')"); pg.wait_for_selector('[data-tab="integrations"]'); pg.click('[data-tab="integrations"]')
    step(pg, "Settings: rules and thresholds, consent and audit logs, WhatsApp and AI status", 3000)

    # second person, live sync and roles
    ctx2 = b.new_context(bypass_csp=True, viewport={"width": 1440, "height": 900}, record_video_dir=OUT + "/exec", record_video_size={"width": 1440, "height": 900})
    pg2 = ctx2.new_page(); pg2.on("pageerror", lambda e: errs.append("exec: " + str(e)))
    login(pg2, "Priyanka Das")
    step(pg2, "Leasing executive: a shorter menu, own clients and own report card only", 3000)
    login(pg2, "Priyanka Das") if False else None
    ctx2.close()

    ctx3 = b.new_context(bypass_csp=True, viewport={"width": 1440, "height": 900}, record_video_dir=OUT + "/owner", record_video_size={"width": 1440, "height": 900})
    pg3 = ctx3.new_page(); pg3.on("pageerror", lambda e: errs.append("owner: " + str(e)))
    owner = pg3.evaluate("fetch('/api/users').then(r => r.json()).then(d => (d.users || d).find(u => u.role === 'owner').name)") if False else None
    pg3.goto(BASE + "/"); pg3.wait_for_selector("[data-key]")
    names = pg3.evaluate("Array.from(document.querySelectorAll('[data-key]')).map(b => b.innerText)")
    owner_btn = next((x for x in names if "Owner" in x), None)
    if owner_btn:
        login(pg3, owner_btn.split("\n")[0])
        step(pg3, "Owner portal: an owner sees only their own units, never occupier names", 3500)
    ctx3.close()

    ctx.close(); b.close()
    print("errors:", errs)
    print("steps:", n[0])
