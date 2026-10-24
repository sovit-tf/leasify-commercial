# Leasify Commercial

A leasing desk for commercial property. One engine runs on the server, Postgres keeps the data, and every open browser updates live. The sample workspace holds 50 invented units and about 100 invented clients.

This repo has two parts:

- `web/` is the screen layer (the tested prototype). It still builds into a single offline file with `python3 web/build.py`.
- `server/` runs the same engine on a Node server, adds sign-in with roles, saves to Postgres and pushes changes to every browser.

Read `ARCHITECTURE.md` before changing anything, and `web/CONTRACT.md` for the writing and UI rules.

## Run it on your computer

You need Node 22 or newer, Python 3 and Postgres 14 or newer.

1. Start Postgres and create a database:

   ```
   createuser leasify --pwprompt      # password: leasify
   createdb leasify -O leasify
   ```

   Or with Docker: `docker compose up db`.

2. Install and start:

   ```
   cp .env.example .env               # optional, the defaults work locally
   npm install
   npm start
   ```

3. Open http://localhost:3000. Pick a person and enter the PIN `2580`.

The first start builds the page, creates the tables and fills the sample data. Later starts load everything back from Postgres.

### Everything in Docker

```
docker compose up --build
```

Then open http://localhost:3000.

### Show it to someone outside your network

Run the app, then in another terminal:

```
cloudflared tunnel --url http://localhost:3000
```

It prints a link ending in `trycloudflare.com`. Send that link. Set `PUBLIC_BASE_URL` to the same link if you also use WhatsApp, so image links work.

## Who can sign in

| Person | Role | What they see |
|---|---|---|
| Sanjeev Das | CEO | Every screen. Only the CEO can reset the demo data and change settings. |
| Rohit Mohanty | Manager | Every screen except Settings. |
| Priyanka Das, Subham Sahoo, Ananya Rath, Satya Mishra | Executive | Their own work. Owner phone numbers on other people's units are hidden. |
| One person per property owner in the inventory | Owner | Only the owner portal, only their own units. |

Everyone uses the demo PIN (`DEMO_PIN`, default `2580`). After 8 wrong PINs in 10 minutes the sign-in pauses for a while.

## Before a demo

The sample dates are set relative to the day the data was created, so they age. Sign in as the CEO and press **Reset demo data** (top bar, click twice to confirm) a little before the demo. Everyone who is signed in reloads the fresh data.

## Settings (environment variables)

Put these in `.env` locally, or in your host's environment settings.

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `postgres://leasify:leasify@localhost:5432/leasify` | Where the data lives. |
| `PORT` | `3000` | Port to listen on. |
| `HOST` | all addresses | Address to listen on. |
| `PUBLIC_BASE_URL` | empty | The public web address, no trailing slash. Used for the cross-site check and WhatsApp image links. |
| `DEMO_PIN` | `2580` | PIN given to each demo person when they are first created. |
| `SESSION_HOURS` | `12` | How long a sign-in lasts. |
| `FLUSH_MS` | `500` | How often changes are written to Postgres. |
| `TRUST_PROXY` | private networks | Which proxies to trust for client IP and https. |
| `ALLOW_ANY_ORIGIN` | off | Set to `1` to skip the cross-site check. Only if you really need it. |
| `DB_SCHEMA` | database default | Keep the tables in their own schema. |
| `NODE_ENV` | empty | Set to `production` when deployed. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | empty | Any OpenAI-compatible AI service. With no key, the agent runs on its rules. See "Turn on the AI" below. |
| `AI_MAX_TOKENS` | `700` | Longest answer asked of the model. `0` leaves it to the provider. |
| `AI_RATE_PER_MIN` | `30` | AI questions one person can ask in a minute. |
| `WA_TOKEN`, `WA_PHONE_NUMBER_ID` | empty | WhatsApp Cloud API access token and phone number id. With no token, WhatsApp is off. |
| `WA_APP_SECRET` | empty | The Meta app secret. Used to check that a webhook post really came from Meta. In production, posts are refused without it. |
| `WA_VERIFY_TOKEN` | empty | Any text you choose. You paste the same text into Meta when you set up the webhook. |
| `WA_GRAPH_VERSION` | `v21.0` | Version of the Meta Graph API. |
| `WA_GRAPH_BASE`, `WA_RETRY_MS` | Meta's address, `1200` | Only for testing: where to send messages, and how long to wait before the one retry. |

Never put real keys in the repo.

## Put it online

The app must run as one always-on process. It keeps the live engine in memory, so serverless hosts will not work. Use a plain web service plus Postgres.

### Railway

1. Create a new project from this repo. Railway finds the `Dockerfile` and builds it.
2. Add a **PostgreSQL** database to the project.
3. On the web service, add the variable `DATABASE_URL` and point it at the database's connection string (use the reference to the Postgres variable).
4. Add `NODE_ENV=production` and, once you have the public address, `PUBLIC_BASE_URL`.
5. Under Networking, generate a public domain. Keep the service at **one** instance.

### Render

1. Create a **PostgreSQL** database. Copy its internal connection string.
2. Create a **Web Service** from this repo, runtime **Docker**, one instance.
3. Add `DATABASE_URL` (the connection string), `NODE_ENV=production` and `PUBLIC_BASE_URL`.
4. Set the health check path to `/healthz`.
5. Use a paid instance for the demo. Free instances go to sleep, which drops the live connections and the WhatsApp agent.

On either host, the server saves on shutdown and loads back on start, so a redeploy does not lose data.

## How it works, briefly

- The server loads `web/js/core.js` and `web/js/inbox.js` into a headless sandbox. That copy of the engine is the source of truth.
- Changes are diffed record by record and written to Postgres about every half second.
- A browser loads its data from `/api/bootstrap`, keeps listening on `/api/events` (server-sent events), and sends its own edits to `/api/sync`. The server checks every edit against the person's role and refuses what they may not change.
- Each role gets a filtered copy of the data. Owners only get their own units.

`GET /healthz` checks the database and reports uptime and the number of open connections. Request logs never contain phone numbers or query strings.

## Tests

```
npm test                  # server tests (needs Postgres, uses a throwaway schema)
npm run test:e2e          # browser smoke test (needs Playwright for Python and Chromium)
python3 tests/e2e_live.py # browser test of the live layer: simulator, take over, WhatsApp, AI (uses fake WhatsApp and AI servers)
```

Set `TEST_DATABASE_URL` to use a different database for the tests. For the browser test, set `PLAYWRIGHT_BROWSERS_PATH` if Chromium is not in the default place.

The offline prototype has its own browser tests in `web/` (for example `python3 web/test_auth_team.py web/dist/Leasify_Commercial_Demo.html`).

## The live agent layer

The server runs the same leasing agent the offline prototype runs. Everyone who is signed in sees the same chats.

- **Simulator.** In Lead inbox, **Simulate 30 leads**, **Add 1 lead**, **Pause**, the speed buttons and the team switch all work on the server. Staff only (CEO, manager, executive).
- **Take over and hand back.** The name on a message a person types is the person who is signed in. A chat held by one person cannot be typed into by another, but a manager can hand it back.
- **Test as an occupier.** The phone in the inbox talks to the real agent, with a real-time clock.
- **WhatsApp.** A person who writes to your WhatsApp number becomes a **Live WhatsApp** chat in the inbox. The agent answers over the Cloud API, unit cards go out as pictures, and delivery ticks show on each message.
- **AI.** Optional. It answers free-form questions in the co-pilot screens and reads WhatsApp messages the rules could not. It never writes the agent's replies and never decides a handoff.

### Turn on WhatsApp

1. In Meta for Developers, create an app with the **WhatsApp** product and add a phone number. Note the **Phone number id** and make a long-lived **access token** (a system user token).
2. Set these on the server, then restart it:

   ```
   WA_TOKEN=<access token>
   WA_PHONE_NUMBER_ID=<phone number id>
   WA_APP_SECRET=<app secret, from App settings > Basic>
   WA_VERIFY_TOKEN=<any text you choose, for example a long random word>
   PUBLIC_BASE_URL=https://your-public-address
   ```

   `PUBLIC_BASE_URL` matters: unit pictures are fetched by Meta from `PUBLIC_BASE_URL/media/unit/<id>.png`, so the address must be reachable from the internet. Without it, unit cards go out as text.
3. Sign in as the CEO, open **Settings and rules > Integrations**. The WhatsApp card shows the **webhook URL** (`PUBLIC_BASE_URL/webhook/whatsapp`) with a copy button.
4. In Meta, open **WhatsApp > Configuration**. Under Webhook, press Edit, paste the webhook URL and the same verify token, and press Verify and save.
5. Under Webhook fields, **subscribe to `messages`**. That field carries both new messages and delivery statuses.
6. Send a message to your WhatsApp number from a phone. A chat with the green **Live WhatsApp** pill appears in the inbox and the agent answers.

Notes. Only people who write first can be answered (the 24 hour service window). Voice notes, photos and documents get a polite reply and a task for the area agent. Anyone who replies STOP is closed and logged as withdrawn consent, and no further message is sent. While you test with a Meta test number, add your phone to the allowed recipients list. `GET /api/wa/status` (CEO and managers) shows whether it is connected, the last message and the last problem.

### Turn on the AI

Any service that speaks the OpenAI chat format works. Set three variables and restart. Each provider is just a base URL and a model name:

| Provider | `AI_BASE_URL` | `AI_MODEL` (example) |
|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Google Gemini (OpenAI-compatible endpoint) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |

```
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=<your key>
AI_MODEL=llama-3.3-70b-versatile
```

Model names change over time, so check the provider's list. Settings and rules > Integrations shows whether the AI is on and which model it uses. Phone numbers are removed from everything sent to the service. A question takes up to 20 seconds before the app gives up, and reading a WhatsApp message takes up to 4 seconds before the agent carries on with its rules.

## Adding more channels

The server loads `server/ai.js`, `server/media.js`, `server/whatsapp.js` and `server/sim.js`. Each exports `register(ctx)`, where `ctx` holds the Express app, config, logger, database pool, the runtime and the sync hub. See `ARCHITECTURE.md` for what each one does.
