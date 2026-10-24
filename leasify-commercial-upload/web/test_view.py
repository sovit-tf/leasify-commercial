"""Smoke-test one or more views: python3 test_view.py <html> <view1,view2> [--shots dir]
Loads the page, opens each view (#id), waits, reports page errors + console errors,
checks horizontal overflow at 390px, and saves desktop + phone + dark screenshots."""
import sys, json, os
from playwright.sync_api import sync_playwright
html, views = sys.argv[1], sys.argv[2].split(",")
shots = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else "/home/claude/demo/shots"
os.makedirs(shots, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    for vp, tag, scheme in [({"width": 1400, "height": 900}, "desk", "light"), ({"width": 390, "height": 844}, "phone", "light"), ({"width": 1400, "height": 900}, "dark", "dark")]:
        pg = b.new_page(viewport=vp, color_scheme=scheme)
        pg.add_init_script("window.__LC_SKIP_LOGIN = true")
        errs = []
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" else None)
        pg.goto("file://" + os.path.abspath(html)); pg.wait_for_timeout(600)
        pg.evaluate("LC.signIn({name: LC.CEO.name, role: 'ceo'})"); pg.wait_for_timeout(300)
        for v in views:
            pg.evaluate(f"location.hash='{v}'"); pg.wait_for_timeout(900)
            ov = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            pg.screenshot(path=f"{shots}/{v}-{tag}.png", full_page=False)
            print(f"[{tag}] {v}: overflow={ov}px")
        print(f"[{tag}] errors:", json.dumps(errs, indent=1) if errs else "none")
        pg.close()
    b.close()
