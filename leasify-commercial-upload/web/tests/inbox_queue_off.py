import os, sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + os.path.abspath("dist/t-inbox.html")); pg.wait_for_timeout(500)
    pg.evaluate("location.hash='inbox'"); pg.wait_for_timeout(400)
    pg.click("[data-sp='6']")
    pg.evaluate("document.querySelector('input[type=checkbox]').click()")
    pg.click("[data-a='sim30']"); pg.wait_for_timeout(15000)
    pg.evaluate("document.querySelector('[data-tab=\"needs\"]').click()"); pg.wait_for_timeout(800)
    pg.screenshot(path="shots/inbox/needs-queue-teamoff.png")
    print(pg.evaluate("LC.queue.waiting().length"), errs or "none")
    b.close()
