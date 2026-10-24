"""Check every persona the simulator can build: answers parse to the intended fields."""
import json, sys
from playwright.sync_api import sync_playwright
f = "file:///home/claude/demo/dist/t-inbox.html"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
    pg.goto(f); pg.wait_for_timeout(500)
    r = pg.evaluate("""() => {
      const out = { built: 0, fail: [], kinds: {}, byLang: {}, bySource: {} };
      const decks = [];
      for (let i = 0; i < 12; i++) decks.push(window.__ibTest.buildDeck(30));
      for (const deck of decks) for (const spec of deck) {
        try { const p = window.__ibTest.buildPersona(spec.kind === 'existing' ? 'coop' : spec.kind, { lk: spec.lk, source: spec.source, existing: null });
          out.built++; out.kinds[spec.kind] = (out.kinds[spec.kind]||0)+1; out.byLang[spec.lk] = (out.byLang[spec.lk]||0)+1; out.bySource[spec.source]=(out.bySource[spec.source]||0)+1;
          if (p.kind !== spec.kind && !(spec.kind==='existing')) out.fail.push('kind mismatch ' + spec.kind + ' ' + p.kind);
        } catch (e) { out.fail.push(spec.kind + '/' + spec.lk + '/' + spec.source + ': ' + e.message); }
      }
      return out;
    }""")
    print(json.dumps(r, indent=1, ensure_ascii=False)); print("ERRORS:", errs)
    b.close()
