# Leasify Commercial demo: build contract for module builders

You are building ONE module file of a single-page, single-file HTML demo for **Leasify Commercial**, a leasing desk product for commercial real estate in Odisha, India (Bhubaneswar, Cuttack, Puri, Trisulia, Phulnakhara, Cuttack-Puri bypass, Jatni). The client is a commercial leasing agency. The demo will be shown to that client, so it must look and work like a real product.

Read these files before writing anything:
- `/home/claude/demo/js/core.js` : the shared `LC` namespace. **Read all of it.** It holds state, utilities, the requirement parser, the match engine, CRM / visits / tasks / handoff-queue APIs, seeded history, router, drawers, AI hooks and CSV sync helpers.
- `/home/claude/demo/00_head.html` and `/home/claude/demo/extra.css` : design tokens and the shared CSS class library. Use these classes first.
- `/home/claude/demo/10_body.html` : the app shell (rail nav, topbar, one `<section class="view" id="v-<id>">` per view).
- `/home/claude/data/inventory.json` : the 50 units (look at 2 or 3 rows to learn the fields). In the page, units live in `LC.state.units` with numbers parsed and `permitted_uses`, `amenities`, `highlights`, `nearby` split into arrays.

## How a module plugs in

```js
(function () {
  const LC = window.LC;
  LC.css(`/* module-only CSS, tokens only */`);
  LC.registerView('inventory', {
    title: 'Inventory', sub: 'One-line subtitle',
    render(el, param) { el.innerHTML = '...'; /* wire events */ },   // called on EVERY show; param from LC.go(id, param)
    onHide() { /* optional cleanup */ },
  });
  // cross-module entry points this module owns (see list below)
  LC.openUnit = (unitId) => { ... };
})();
```

- Plain ES2020, no frameworks, no build step. No external libraries unless your brief says so.
- Render with template strings + `innerHTML`, then attach listeners. **Escape every piece of data with `LC.esc()`** (names, notes, user input).
- Re-render live only when your view is visible: `LC.on('clients:changed', () => LC.isActive('crm') && rerender())`. Keep handlers cheap; debounce if an event can fire many times a second (the lead simulator emits often).
- Never call `alert`, `confirm`, `prompt`, `window.print`, `window.open`. Build confirmations into the page. Links to other sites are plain `<a href target="_blank" rel="noopener">`.
- No `fetch` to external hosts, no `localStorage` needed (state is in memory; "Reset demo data" re-seeds).
- Must work at 390 px wide (no horizontal page scroll; wide tables go in `.tbl-wrap`), and in light and dark themes (use CSS tokens only: `var(--surface)`, `var(--fg)`, `var(--muted)`, `var(--brand)`, `var(--good)`, `var(--warn)`, `var(--bad)` etc.; never a literal colour that only works in one theme).
- Build up the UI from the shared classes: `.card .card-h .card-b`, `.kpis .kpi`, `.tbl-wrap table.tbl`, `.btn .btn.primary .btn.sm`, `.field label .input`, `.pill (.good .warn .bad .brand .demo)`, `.chips .chip`, `.grid-2 .grid-3 .split`, `.toolbar`, `.tabs`, `.row .stack .between`, `.note`, `.lede`, `.eyebrow`, `.empty`, `.timeline`, `.kv`, `.hbar`, `.defs`, `.seg`, the WhatsApp classes (`.phone .wa-head .wa-body .bub.in/.out/.sys .wa-card .wa-quick .wa-input .typing`), the chat classes (`.chat .chat-body .msg.me/.ai .chat-input`), `.factors .factor`, `.match-row`. Add your own module CSS through `LC.css()` with a module prefix on class names (e.g. `.inv-card`).
- Charts: inline SVG with `class="chart"`, drawn to scale, colours from tokens, with an `aria-label`. One accent (`var(--brand)`); semantic colours only for good/warn/bad. Label values directly.

## Writing rules (the client reads every word)

- Plain, simple English. Short sentences. Sentence-case headings. Contractions are fine.
- **Never use em-dashes (—).** Use a comma, a full stop or a colon. En-dash only inside number ranges (2,000–3,000).
- No hype words, no "seamless", "powerful", "unlock", "leverage". Say what a thing does.
- Every number, score or metric shown must have its meaning available (a `title`, a small definitions block, or a "How this works" note). Use `LC.METRICS`, `LC.STAGE_DEFS`, `LC.MATCH_FACTORS`, `LC.MATCH_RULES` definitions.
- Money in rupees with Indian grouping: `LC.fmtINR`, `LC.fmtLakh` (₹1.6 L), per sq ft as `₹58/sq ft`. Areas with `LC.fmtSqft`. Dates with `LC.fmtDate`, `LC.fmtDT`, `LC.relTime`.
- Never mention HomeEasy or any real company. Everything is invented sample data; say "sample" where a viewer could mistake it for real.
- The product name is "Leasify Commercial". The client's team uses it; occupiers (tenants) are "occupiers" or "clients"; landlords are "owners".

## Shared entry points (who owns what)

Call other modules only through these, always guarded (`LC.openUnit && LC.openUnit(id)`):

| Function | Owner file | What it does |
|---|---|---|
| `LC.openUnit(unitId)` | inventory.js | Opens the full listing detail drawer |
| `LC.openCompare(unitIds?)` | inventory.js | Opens the side-by-side compare drawer |
| `LC.runOwnerCheck()` | inventory.js | Runs the weekly WhatsApp availability check across owners (simulated replies) |
| `LC.openLead(leadId)` | inbox.js | Goes to the inbox with that conversation open |
| `LC.sim` | inbox.js | `{ start(n), stop(), running, stats() }` lead simulator |
| `LC.openClient(clientId)` | crm.js | Opens the client drawer (requirement, history, movement, timeline) |
| `LC.openBookVisit({clientId, unitId})` | crm.js | Small drawer to book a visit (uses `LC.visits.slots`, `LC.visits.book`) |
| `LC.go('match', {clientId} or {req})` | match.js | Opens Requirement match prefilled |
| `LC.shareText(unitIds, req, language)` | match.js | Returns WhatsApp-ready text describing up to 3 units |
| `LC.draftTermSheet(unitId, clientId?)` | copilot.js | Returns a plain-text term sheet draft |

## Data notes

- `LC.state.clients` (CRM) already has ~96 seeded clients across 70 days with stageHistory (movement), reqHistory (requirement changes), timeline, shared units, visits; `LC.state.visits` has past and upcoming visits; `LC.state.tasks` has open tasks; `LC.state.queue` starts empty and fills from the simulator.
- A unit is matchable only if `LC.isMatchable(u)`. Freshness via `LC.unitFreshness(u)`.
- Requirement object: see `LC.emptyReq()`. Parse text with `LC.parseRequirement(text, baseReq, {expect})`. Match with `LC.match(req, {limit})` which returns `{exact, close, excluded, exactCount, closeCount}`.
- AI: when the page runs as a published artifact, `LC.ai.sample` may be available (`LC.askClaude(prompt)`, `LC.askClaudeJSON(prompt)`). It is null in the standalone file. **Every feature must fully work without it**; Claude is an optional upgrade, labelled with `<span class="ai-tag">Claude</span>`. Listen for `LC.on('ai:ready', ...)` to light it up. Call it only on a click, never on load. Catch errors and fall back.

## Test your module

```
cd /home/claude/demo
python3 build.py --only <yourfile.js>[,<other.js>] --out dist/t-<yourname>.html
python3 test_view.py dist/t-<yourname>.html <viewId>[,<viewId2>] --shots shots/<yourname>
```
Then look at the screenshots with the Read tool (desktop, phone, dark). Fix every page error and console error, any overflow > 0 px at phone width, and anything that looks broken. You may write an extra Playwright script to click through your interactions. Do NOT edit core.js, 00_head.html, 10_body.html, extra.css, build.py or another module's file. If core.js has a bug that blocks you, work around it inside your file and mention it in your report.

## Report back (short)

1. What you built (features list, one line each).
2. The entry points you defined.
3. Any core.js issue you worked around.
4. Test result: errors (should be none), overflow at phone width, and which screenshots you checked.

## Lead object (owned by inbox.js, read by dashboard / co-pilot / CRM)

`LC.state.leads` holds live conversations created by the simulator or the "test as an occupier" chat:

```js
lead = {
  id, clientId,                 // clientId links to LC.state.clients (created on first contact)
  name, company, phone, source, language,   // language: 'English' | 'Hindi' | 'Odia'
  status,                       // 'ai' | 'handoff' | 'human' | 'booked' | 'nurture' | 'closed'
  createdAt, lastAt,            // ms timestamps
  firstReplyMs,                 // ms from first inbound to first AI reply
  messages: [{ from: 'lead'|'ai'|'agent'|'system', text, ts, by?, cards?: [unitId], quick?: [string] }],
  req,                          // requirement captured so far (LC.emptyReq shape)
  matches: [unitId],            // units sent
  visitId,                      // when booked
  handoff: { rule, reason, at, queueId, assignee } | null,
  rulesFired: [ruleId],
}
```
inbox.js emits `leads:changed` (throttled) and `lead:updated` (id).
