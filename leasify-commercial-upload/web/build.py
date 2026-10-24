"""Assemble the single-file demo.
   dist/leasify-commercial-demo.html      -> artifact body (no doctype; publish wraps it)
   dist/Leasify_Commercial_Demo.html      -> standalone file (full document, opens in any browser)

   python3 web/build.py --server          -> dist/app.html, the page the Node server serves.
       Adds js/net.js right after core.js and sets window.LC_SERVER = true, so the page loads its data
       from the server (role-filtered) instead of the embedded sample. The inventory is NOT embedded."""
import json, re, sys
from pathlib import Path
D = Path(__file__).parent
import argparse
ap = argparse.ArgumentParser(); ap.add_argument("--only", default=""); ap.add_argument("--out", default=""); ap.add_argument("--server", action="store_true")
args = ap.parse_args()
ORDER = ["core.js", "inventory.js", "inbox.js", "match.js", "copilot.js", "crm.js", "owners.js", "dashboard.js", "ceo.js", "team.js", "analytics.js", "settings.js", "auth.js"]
head = (D / "00_head.html").read_text(encoding="utf-8")
body = (D / "10_body.html").read_text(encoding="utf-8")
inv = json.loads((D.parent / "data" / "inventory.json").read_text(encoding="utf-8"))
data = json.dumps(inv, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
dictionary = (D.parent / "data" / "dictionary.json").read_text(encoding="utf-8").replace("</", "<\\/")
js = []
if args.only: ORDER = ["core.js"] + [x for x in args.only.split(",") if x and x != "core.js"]
if args.server: ORDER = [ORDER[0], "net.js"] + ORDER[1:]
for f in ORDER:
    p = D / "js" / f
    if p.exists():
        js.append(f"/* ==== {f} ==== */\n" + p.read_text(encoding="utf-8"))
    else:
        print("missing (skipped):", f, file=sys.stderr)
extra_css = (D / "extra.css").read_text(encoding="utf-8") if (D / "extra.css").exists() else ""
head = head.replace("</style>", extra_css + "\n</style>", 1)
if args.server: data = "[]"   # units come from the server, filtered for the signed-in role
page = (head + "\n" + body +
        f'\n<script type="application/json" id="lc-inventory">{data}</script>\n'
        f'<script type="application/json" id="lc-dictionary">{dictionary}</script>\n'
        + ("<script>window.LC_SERVER = true;</script>\n" if args.server else "") +
        "<script>\n" + "\n".join(js) + "\nLC.boot();\n</script>\n")
out = D / "dist"; out.mkdir(exist_ok=True)
if not args.out and not args.server: (out / "leasify-commercial-demo.html").write_text(page, encoding="utf-8")
full = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
        + page + "</body></html>")
(Path(args.out) if args.out else out / ("app.html" if args.server else "Leasify_Commercial_Demo.html")).write_text(full, encoding="utf-8")
print("built", round(len(page) / 1024), "KB")
