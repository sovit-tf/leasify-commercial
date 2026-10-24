"""50 leads at 6x: measure long frames and main-thread block, in dark theme, at 1400 wide."""
import json, sys, os
from playwright.sync_api import sync_playwright
html = sys.argv[1] if len(sys.argv) > 1 else "dist/t-inbox.html"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + os.path.abspath(html)); pg.wait_for_timeout(500)
    pg.evaluate("location.hash='inbox'"); pg.wait_for_timeout(400)
    pg.evaluate("document.documentElement.setAttribute('data-theme','dark')")
    pg.evaluate("""() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({entryTypes:['longtask']}); }""")
    pg.click("[data-sp='6']"); pg.evaluate("LC.sim.start(50)")
    pg.wait_for_timeout(30000)
    r = pg.evaluate("() => ({ longtasks: window.__lt.length, maxMs: Math.max(0, ...window.__lt), live: LC.sim.stats().live, total: LC.sim.stats().total, rules: Object.keys(LC.sim.stats().rules).length })")
    pg.screenshot(path="shots/inbox/perf50-dark.png")
    print(json.dumps(r), "ERRORS:", errs or "none")
    b.close()
