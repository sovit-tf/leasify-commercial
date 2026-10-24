# Leasify Commercial: Tuesday demo runbook

## 1. Go live (once, Monday)

1. **Host it.** Pick one:
   - **Railway (recommended):** new project, add a Postgres database, then deploy this folder (GitHub repo or `railway up`). Railway gives you an https link.
   - **Your laptop:** install Docker Desktop, run `docker compose up -d` in this folder, then `cloudflared tunnel --url http://localhost:3000` for a public https link. The laptop must stay awake during the demo.
2. **Set the server settings** (Railway Variables, or a `.env` file next to `docker-compose.yml`):

   | Setting | Value |
   |---|---|
   | `DATABASE_URL` | From Railway Postgres (compose sets it for you) |
   | `PUBLIC_BASE_URL` | Your https link, no trailing slash |
   | `DEMO_PIN` | A PIN only your team knows (default 2580) |
   | `WA_TOKEN` | Meta permanent system-user token |
   | `WA_PHONE_NUMBER_ID` | From Meta > WhatsApp > API setup |
   | `WA_APP_SECRET` | Meta app > Settings > Basic > App secret |
   | `WA_VERIFY_TOKEN` | Any word you choose, used once in step 3 |
   | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Your AI provider (see README) |
   | `TZ` | `Asia/Kolkata` (already the default) |

3. **Connect Meta.** Meta app > WhatsApp > Configuration > Webhook: callback URL `PUBLIC_BASE_URL/webhook/whatsapp`, verify token = `WA_VERIFY_TOKEN`. Click Verify, then subscribe to `messages`. In the app, Settings > Integrations shows the same link with a copy button, and turns green once a message arrives.
4. **Check the phones.** Every phone that will message the test number must be in Meta's recipient list (max 5) and verified.
5. **Test once.** From your phone, send "Hi, need office 2000 sq ft in Patia" to the test number. You should get a reply in a few seconds, unit pictures, and buttons. The chat shows in the Lead inbox with a green "Live WhatsApp" pill.

## 2. Morning of the demo

- Sign in as Sanjeev Das (CEO) and click **Reset demo data**. Dates then line up with today.
- Send one test WhatsApp message to wake everything up, then reset again if you want a clean inbox.
- Keep a second browser window signed in as an executive (for example Priyanka Das) to show live updates and roles.

## 3. Demo flow (about 20 minutes)

1. **Live WhatsApp first.** Hand the client a verified phone (or use yours on screen). They message the test number in English, Hindi or Odia. The room watches the reply land in under a minute, the questions, three unit pictures, and the visit booking. On the big screen the chat appears live in the Lead inbox, the client appears in CRM, and the visit lands in Site visits with a confirmation call task.
2. **Ask for a discount** on WhatsApp ("can you do a lower rent?"). The agent stops on price and the chat moves to "Needs a person" (rule H1). Take over, type a reply, it reaches the phone. Hand back.
3. **Simulator.** Start 30 leads to show the desk under load, 11 sources, 3 languages, handoff queue with SLA timers.
4. **Inventory and match.** Filter offices in Patia, open LC-001, cost calculator. Requirement match with factor scores and a close option.
5. **Owner check.** Run the weekly owner check: replies 1, 2, 3, a flagged unit, a call task.
6. **Co-pilots.** Leasing co-pilot ("which units have had visits but no offer?"), term sheet draft. CEO co-pilot brief and focus list. Team report cards.
7. **Roles.** In the second window, show the executive's limited menu. Sign in as an owner: only their own units, no occupier names.

## 4. If something fails

| Problem | Do this |
|---|---|
| No WhatsApp reply | Settings > Integrations: check "Last problem". Most common: token expired or phone not in the recipient list. Fall back to "Test as an occupier" in the Lead inbox (same agent). |
| AI is off or slow | Nothing breaks. The rule engine answers. |
| Page shows "Reconnecting" | The server restarted. It reconnects by itself in a few seconds. |
| Data looks old | CEO > Reset demo data. |

## 5. What is real and what is sample

- Real: server, database, sign-in and roles, audit and consent logs, WhatsApp agent on Meta's API, AI provider, live updates.
- Sample: every unit, owner, company and person. Portal, Google Sheet and calendar connections are shown as simulated. Hindi and Odia lines need a native speaker's review before real occupiers see them.
