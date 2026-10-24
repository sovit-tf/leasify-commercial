# Leasify Commercial v1: architecture (the rulebook)

Owner: MSM Global Consulting. Read this before touching any file. Also read `web/CONTRACT.md` (UI and writing rules) and `LEASIFY_COMMERCIAL_MASTER_HANDOVER.md`.

## Goal

Turn the proven single-file prototype in `web/` into a real, multi-user product for a demo on Tue 27 Oct 2026:
server, Postgres, server-side sign-in and roles, a server-side WhatsApp leasing agent wired to the Meta WhatsApp Cloud API, an OpenAI-compatible AI provider, live updates to every open browser. Dummy data (the 50 units and seeded history) stays.

## Core decision: one engine, run on the server

The prototype's domain logic (`web/js/core.js`: parser, match engine, CRM/visit/task/queue APIs, seed; `web/js/inbox.js` lines 1 to ~1300: the WhatsApp agent `aiRespond/receive`, handoff rules H1-H9, nudges, simulator) is tested and matches the PRD. We do NOT rewrite it. We run the same files in Node:

- `server/runtime.js` loads `web/js/core.js` and `web/js/inbox.js` into a Node `vm` context with a minimal `window`/`document` stub (no rendering). It overrides `LC.loadInventory` to read `data/inventory.json`, keeps `LC.NOW` fresh (update every 30 s), and makes `LC.registerView`, `LC.css`, `LC.toast`, `LC.drawer` no-ops.
- That server-side `LC.state` is the **source of truth** (single Node process, in memory), persisted to Postgres.
- Browsers run the full prototype UI for rendering. Their `LC.state` is a **replica**: hydrated from the server, patched live over SSE, and their own edits are pushed to the server.

Why: zero re-implementation risk for Tuesday, and the agent replying on real WhatsApp is the same code the UI shows. A single always-on Node process is required (no serverless).

## Repo layout

```
app/
  ARCHITECTURE.md        this file
  data/                  inventory.json, dictionary.json, generators (unchanged)
  web/                   prototype UI (js/*.js, 00_head.html, 10_body.html, extra.css, build.py)
    js/net.js            NEW: browser sync layer (hydrate, push diffs, SSE apply, AI shim, remote actions)
  server/
    index.js             HTTP server (Express), routes, static page
    runtime.js           headless LC engine in a vm context
    store.js             Postgres schema, load, seed, write-behind flush
    sync.js              record diffing, per-role filtering, write authorisation, SSE hub
    auth.js              users, PIN hashing (scrypt), sessions (httpOnly cookie)
    ai.js                OpenAI-compatible chat client (+ tool calls), extraction fallback
    whatsapp.js          Meta Cloud API: webhook verify, signature check, inbound map, outbound send
    media.js             unit card PNGs for WhatsApp (SVG -> PNG with sharp)
    sim.js               simulator and lead actions API (start/stop/addOne, take over, hand back, agent send, test chat)
    migrations/001_init.sql
  tests/                 node:test unit/integration + Playwright e2e (python)
  Dockerfile, docker-compose.yml, .env.example, README.md
```

## Data model (Postgres)

Every collection in `LC.state` maps to one table. Each table has `id text primary key`, a few typed, indexed columns for querying, `data jsonb not null` (the full record exactly as `LC.state` holds it), `updated_at timestamptz`, `updated_by text`. The jsonb keeps the engine's shape intact; the typed columns make it queryable and reportable.

| Table | id source | Typed columns |
|---|---|---|
| units | unit_id | status, city, property_type, owner_name, listing_agent, last_confirmed |
| clients | id | stage, agent, phone, source, created_at |
| leads | id | status, phone, source, channel ('sim','test','whatsapp'), client_id, last_at |
| visits | id | client_id, unit_id, status, when_at, agent |
| tasks | id | type, assignee, due_at, done |
| queue_items | id | lead_id, rule, status, assignee, sla_due |
| activity | generated id | ts, kind |
| audit_log | generated id | ts, entity, record_id, by |
| consent_log | generated id | ts, phone, channel |
| sync_runs | generated id | ts |
| settings | 'main' | (data only) |
| users | id | name, role, owner_name, pin_hash, active |
| sessions | token hash | user_id, expires_at |
| wa_events | generated id | ts, direction ('in','out'), wa_id, status, raw jsonb |
| login_log | generated id | ts, user_id, role |

Append-only collections (activity, audit, consent, syncLog) are arrays in `LC.state`; give each entry a stable id (`_id`) when first seen and insert only new ones.

Seed: on boot, if `units` is empty, run `LC.initState()` in the runtime and persist everything. "Reset demo data" (CEO only) truncates and reseeds, then tells every browser to reload state.

Write-behind: the runtime marks collections dirty on every `LC.emit`. A flusher (every 500 ms) diffs records against the last persisted JSON per id and upserts changed rows in one transaction. On shutdown (SIGTERM) flush once more.

## Sync protocol

- `GET /api/bootstrap` (signed in): `{ session, state, version }`. State is role-filtered (below). Browser replaces `LC.state` with it, keeping UI-only fields (`shortlist`, `compare`) local.
- `GET /api/events` (SSE): server pushes `{type:'patch', collection, upserts:[records], removes:[ids], origin}`, `{type:'reset'}`, `{type:'settings', settings}`. Patches are role-filtered per connection. Server batches patches every 150 ms.
- `POST /api/sync` `{ changes: [{collection, upserts, removes}] , clientId }`: browser pushes records it changed. Server authorises each record (below), applies it to the runtime `LC.state` (replace by id, then emit the matching LC event so the engine sees it), persists, broadcasts. Response lists rejected records with a reason; browser shows `LC.toast` and re-pulls those records.
- Browser `net.js` keeps a `lastSynced` JSON map per collection/id. After any LC event (debounced 250 ms) it diffs and pushes. When it applies an incoming patch it updates `lastSynced` first, so nothing echoes back.
- Leads are server-owned. Browsers never push `leads`; lead actions go through `/api/leads/:id/...` and `/api/sim/...` (see sim.js).

### Role filter (read)

| Role | Gets |
|---|---|
| ceo, manager | everything |
| executive | everything except settings write; owner phone shown only on units where `listing_agent` is them (else masked `+91 9XXXX XX123`) |
| owner | only their units (`owner_name` = session owner); visits on those units with client name/company/phone removed; clients reduced to `{id, stage, shared (only their units), unitId if their unit}`; no leads, queue, tasks (except owner-check tasks on their units), consent, audit except their units; settings as read-only |

### Write rules (server-enforced)

| Collection | ceo | manager | executive | owner |
|---|---|---|---|---|
| units | yes | yes | only units where listing_agent is them | no (owner replies go through `POST /api/owner/reply`) |
| clients | yes | yes | clients where agent is them, and new clients | no |
| visits, tasks | yes | yes | where agent/assignee is them, or for their clients | no |
| queue_items | yes | yes | resolve items assigned to them or their area | no |
| settings | yes | no | no | no |
| leads | via actions API only | | | |

Every accepted unit field change writes an `audit_log` row server-side (field, from, to, by = session user name, channel 'app' or 'sheet'). Every settings change writes an audit row too (fixes a PRD gap).

## Auth

- Users are seeded from `LC.TEAM`, `LC.CEO` and one user per distinct `owner_name` in the inventory. Default PIN from env `DEMO_PIN` (default `2580`), hashed with scrypt. CEO can change PINs later (not needed for Tuesday).
- `POST /api/login {userId, pin}` → httpOnly, SameSite=Lax, Secure (when HTTPS) cookie; 12 h expiry. `POST /api/logout`. `GET /api/me`.
- Login page: keep the prototype's sign-in look (`web/js/auth.js`) but call the server; wrong PIN shows an error. The page lists the demo people as before.
- All `/api/*` except login and the WhatsApp webhook require a session. Role checks on every route.

## AI provider (any OpenAI-compatible API)

- Env: `AI_BASE_URL` (e.g. `https://api.groq.com/openai/v1`), `AI_API_KEY`, `AI_MODEL`. Missing key = AI off; everything still works on rules.
- `POST /api/ai/chat {messages, tools?, json?}` → calls `${AI_BASE_URL}/chat/completions`. Returns text, or tool_calls for the browser shim to run.
- Browser shim in `net.js`: defines `window.claude.use('sample')` so the existing `LC.ai.sample` hooks light up. `sample(promptOrMessages, opts)` runs the tool-call loop client-side (page tools stay in the page), `sample.json(...)` asks for JSON. `use('mcp')` resolves null.
- Server-side agent use: only as an **extraction fallback**. When an inbound WhatsApp message parses to nothing new and isn't a known intent, ask the model for the requirement fields as JSON, validate each value against `LC.USES`, `LC.LOCALITIES`, `LC.CITIES`, `LC.FURNISHING`, number ranges, then pass a normalised English line (e.g. "office 2000 sq ft budget 70 per sq ft in Patia") to the engine's `receive()`. 4 s timeout. The model never writes replies, never sees phone numbers, never decides handoffs. Guardrails H1-H9 stay in code.

## WhatsApp (Meta Cloud API)

- Env: `WA_TOKEN` (permanent system-user token), `WA_PHONE_NUMBER_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `WA_GRAPH_VERSION` (default `v21.0`), `PUBLIC_BASE_URL`.
- `GET /webhook/whatsapp`: hub.mode=subscribe and hub.verify_token match → echo hub.challenge.
- `POST /webhook/whatsapp`: verify `X-Hub-Signature-256` (HMAC SHA-256 of the raw body with `WA_APP_SECRET`, timing-safe compare); 401 if wrong. Ack 200 fast, process async. De-dupe by message id. Log raw to `wa_events`.
- Inbound: text, interactive `button_reply`/`list_reply` (use the title text), location (pass "location lat,lng" plus nearest locality name), audio/image/document (reply politely that a person will check it, raise a task). Map `wa_id` → live lead with channel 'whatsapp' on that phone, else create one through the engine (source 'Office WhatsApp', real-time clock like the prototype's test chat), with the profile name. H9 behaviour comes free from the engine.
- Outbound: hook the engine's message append for whatsapp-channel leads. `ai`/`agent` messages → text; `cards: [unitId]` → one image message per unit (PNG from `media.js` at `${PUBLIC_BASE_URL}/media/unit/<id>.png`, caption: title, all-in ₹/sq ft and monthly, size, available date, fit score, maps link); `quick: [..]` → interactive reply buttons (max 3, title ≤ 20 chars) or a list if more. Send in order, one at a time. Log every send and every status callback (sent, delivered, read, failed) to `wa_events`; show a small delivery tick in the inbox thread.
- Only the 24 h service window is used (the occupier writes first). No templates needed for the demo.
- Inbox: whatsapp leads show a green "Live WhatsApp" pill. Team can take over and type; the text goes to the phone.

## Simulator and lead actions (server)

- `POST /api/sim/start {n}`, `/api/sim/stop`, `/api/sim/add {source}`, `POST /api/sim/speed {x}`: run the engine's `LC.sim` on the server so every viewer sees the same chats.
- `POST /api/leads/:id/takeover`, `/handback`, `/send {text}`, `POST /api/test-chat {text, leadId?}` (the "Test as an occupier" phone): call the engine functions.
- inbox.js in the browser: when `LC.remote` is true, the engine never runs locally; UI actions call these endpoints and the UI re-renders from SSE patches. Keep every UI feature.

## Non-negotiables

- Never mention HomeEasy. No em-dashes in any UI text or docs. Plain English (see `web/CONTRACT.md`).
- No secrets in code or logs; `.env` only. Mask phone numbers in logs.
- Escape all data in HTML (`LC.esc`). Parameterised SQL only.
- Every screen keeps working at 390 px and in dark mode.
- The standalone prototype build (`web/build.py` without `--server`) must still work offline.
