# Leasify Commercial: product requirements

| Item | Detail |
|---|---|
| Product | Leasify Commercial |
| Owner | MSM Global Consulting Private Limited. Consultant: Sovit Biswal. |
| First client | A commercial leasing agency in Bhubaneswar, assumed to hold owner mandates |
| Version and date | 1.0, October 2026, draft |
| Companion documents | Leasify Commercial strategy; commercial proposal (prices and terms are not in this document) |
| Source of rules | Rule ids, factor weights, stage names and thresholds match the demo prototype's data model. If the two differ, the prototype is corrected to match this document after review. |

## 1. Purpose and scope

Leasify Commercial runs a commercial leasing desk from first enquiry to signed lease on one live record of every unit. AI answers first and people close.

**In scope:** inventory, Google Sheet sync, lead ingestion and the WhatsApp leasing agent, handoff rules, requirement capture, requirement match, leasing co-pilot, CRM, site visits, owner portal, dashboard and analytics, settings.

**Areas covered by the demo:** Bhubaneswar (including the Cuttack-Puri bypass), Cuttack, Puri, Trisulia, Phulnakhara and Jatni. Areas are settings, not code.

**Property types:** Office, Coworking, Retail shop, Showroom, F&B space, Clinic, Institutional, Warehouse, Industrial shed.

**Terms used in this document:** "occupier" or "client" is the business looking for space. "Owner" is the landlord. "Team" is the client's leasing staff. "Unit" is one leasable space. A glossary of leasing terms is in Appendix B.

## 2. Users and roles

| Role | Who | Main jobs |
|---|---|---|
| Leasing manager | Senior manager who runs the desk | Watches the pipeline, takes large deals and complaints, sets rules, reviews numbers |
| Leasing executive | Area agent, covers one or more cities | Calls leads, confirms and runs visits, sends proposals, keeps own listings current |
| Admin | Office or operations lead | Team and access, templates, integrations, consent and audit logs |
| Owner | Landlord with one or more units on mandate | Confirms availability weekly, reads the unit report, asks questions (Phase 3) |
| Occupier | Business looking for space | Talks to the WhatsApp agent, receives options, books and attends visits |

### Access matrix

Key: **All** = every record. **Own** = records assigned to that user (own clients, own listings, own units for owners). **View** = read only. **No** = no access.

| Action | Leasing manager | Leasing executive | Admin | Owner | Occupier |
|---|---|---|---|---|---|
| View inventory | All | All | All | Own units | Units shared with them |
| Edit unit terms, run sheet sync | All | Own listings | All | No (replies 1/2/3 only) | No |
| See owner phone, mandate, brokerage | All | Own listings | All | Own | No |
| Lead inbox: read, take over, hand back | All | Own and own area's queue | View | No | Own chat |
| CRM clients | All | Own, plus view of all | View | No | No |
| Reassign leads and clients | Yes | No | Yes | No | No |
| Book, confirm and close visits | All | Own | All | View own units' visits (no occupier names) | Own visits |
| Dashboard | All | Own numbers plus team pipeline | All | Own unit report | No |
| Analytics | All | Own | All | No | No |
| Co-pilot | Leasing co-pilot, all data | Leasing co-pilot, own clients and all inventory | Leasing co-pilot, all data | Owner co-pilot, own units | No |
| Rule toggles, thresholds, templates | Edit | View | Edit | No | No |
| Team, roles, integrations | View | No | Edit | No | No |
| Consent log and audit log | View | View own listings | View and export | No | Own consent record on request |

**Demo compared with production.** The demo signs everyone in as the senior leasing manager and does not enforce roles. Its Settings screen shows a shorter access table that differs from this one (for example, it gives the leasing manager no access to Settings). This table is the one to build.

## 3. Goals and success metrics

Every metric has one written definition. The dashboard, analytics and co-pilots use only these. "Metric key" is the name the demo's code uses for the metric.

| Metric key | Name | Definition | Target (day 180) |
|---|---|---|---|
| enquiries | Enquiries | Clients created in the period, from any source. | Baseline from discovery |
| qualified | Qualified | Clients whose use, size, budget and area were captured. | Tracked |
| visits | Site visits | Site visits marked Done in the period. | Tracked |
| proposals | Proposals | Clients who reached Proposal in the period. | Tracked |
| lois | Letters of intent | Clients who signed a letter of intent in the period. | Tracked |
| signed | Signed leases | Clients who reached Signed lease in the period. | Above baseline |
| firstReply | First reply | Median seconds from enquiry to the first reply (AI agent). | Under 60 s, with 95% under 2 minutes |
| firstHuman | Follow-up speed | Median minutes from enquiry to first contact by a person. | 15 min or less in staffed hours |
| daysVacant | Days vacant | Days since the unit's available-from date, while it stays unleased. | Falling quarter on quarter |
| askingVsAchieved | Asking against achieved | Rent per sq ft in signed leases divided by the listed rent. | Tracked |
| sourceToClose | Source to close | Signed leases divided by enquiries, per lead source. | Tracked per source |
| noShow | No-show rate | Booked visits that did not happen, divided by booked visits. | Under 20% |

Four more goals come from the strategy's 180-day plan:

| Name | Definition | Target (day 180) |
|---|---|---|
| Confirmed share | Available units with an owner confirmation in the last 14 days, divided by all Available units | 95% or more |
| Record matched at visit | Visits where the team marked "status and terms matched the record", divided by visits done | 95% or more |
| Enquiry to visit | Enquiries in a month that reach Site visit within 30 days, divided by enquiries that month | 20%, or 1.5x baseline if higher |
| Visit to signed | Clients with a visit done in a month who sign within 90 days, divided by clients with a visit done that month | 10%, or baseline if higher |

Example, asking against achieved: listed rent ₹58/sq ft, signed at ₹55/sq ft. Asking against achieved = 55 ÷ 58 = 94.8%.

## 4. Module requirements

Each module lists user stories, numbered functional requirements (each one testable), business rules, and what the demo shows compared with production.

### 4.1 Inventory

**User stories**

- As a leasing executive, I want to find every available unit that fits a client in seconds, so I can send options on the same call.
- As a leasing manager, I want unconfirmed units to drop out of matching, so we never pitch old information.

**Schema: 72 fields in 9 groups**

| Group | Fields |
|---|---|
| Identity (8) | unit_id, listing_title, property_type, grade, building_name, unit_no, floor, total_floors |
| Location (9) | city, locality, micro_market, address, pincode, lat, lng, road_width_ft, nearby |
| Use (1) | permitted_uses |
| Area (4) | carpet_sqft, super_builtup_sqft, chargeable_sqft, loading_pct |
| Money terms (18) | pricing_model, rent_per_sqft, monthly_rent, seats, price_per_seat, cam_per_sqft, all_in_per_sqft, all_in_monthly, gst_pct, deposit_months, deposit_amount, lock_in_months, lease_term_years, escalation_pct, escalation_every_years, rent_free_days, negotiable, brokerage_months |
| Condition and specs (16) | furnishing, workstations, cabins, meeting_rooms, washrooms, ac_type, power_backup, power_load_kw, parking_4w, parking_2w, frontage_ft, clear_height_ft, fire_noc, occupancy_certificate, building_age_years, amenities |
| Marketing (5) | highlights, description, photos, floor_plan, video_tour |
| Status and freshness (6) | status, available_from, listed_date, last_confirmed, confirmed_via, data_flag |
| Owner and deal (5) | owner_name, owner_type, owner_phone, mandate, listing_agent |

Each field has a plain-language definition in the sheet's "Data dictionary" tab.

**Derived fields.** The system recomputes these on every import, so a typed value can't drift:

| Field | Formula |
|---|---|
| loading_pct | (super_builtup_sqft − carpet_sqft) ÷ carpet_sqft × 100, rounded |
| monthly_rent | rent_per_sqft × chargeable_sqft, rounded to the nearest ₹5 |
| all_in_per_sqft | rent_per_sqft + cam_per_sqft |
| all_in_monthly | all_in_per_sqft × chargeable_sqft, rounded to the nearest ₹5 |
| deposit_amount | monthly_rent × deposit_months |

**Functional requirements**

- INV-1. Search by keyword across title, building, locality, address and description.
- INV-2. Filters: city, property type, permitted use, chargeable area range, maximum all-in ₹/sq ft, furnishing, available now or within 30 days, include under negotiation and LOI, include leased, minimum car parks, minimum frontage, minimum clear height, grade, 100% power backup, ground floor, fire NOC, occupancy certificate, lift, main road facing, exclusive mandate only, hide units not confirmed in 14 days, shortlist only. Production adds locality, a monthly all-in range, negotiable, and has floor plan or video.
- INV-3. Sort: recommended (Available first, then freshest, best grade and lowest all-in for the type), all-in low to high, all-in high to low, size large to small, newest listed, recently confirmed, longest on the market. The table also sorts by any column.
- INV-4. Four views of the same result set: grid of cards, compact list, a schematic map with one pin per unit (Bhubaneswar to Cuttack region, and Puri), and a 20-column table that copies as CSV. Production adds a column picker over all 72 fields.
- INV-5. Each card shows photo, title, unit id and address, all-in ₹/sq ft and monthly, chargeable and carpet area, furnishing, available-from date, status, freshness badge, grade and any data flag.
- INV-6. Listing page: photos and a floor plan, price and terms, cost calculator, area block (carpet, super built-up, chargeable, loading shown up front), specs and compliance, permitted uses, amenities, nearby landmarks, owner and mandate (role-gated in production), last confirmation, clients this unit fits, visits with feedback, change history, similar units, Google Maps link and directions, and actions (shortlist, compare, share, book a visit, draft term sheet, mark owner confirmed, change status).
- INV-7. Cost calculator. It uses the unit's terms. The user can change the lease years, the rent-free days and whether GST is included. Outputs: move-in cost (deposit plus the first month's rent and CAM, plus GST when ticked), total lease value over the term, effective all-in ₹/sq ft over the term, rent-free saving, and a year-by-year table of rent, CAM, GST and total. Rent rises by the escalation, CAM stays flat, and rent-free days come off year 1 only. The deposit is in the move-in cost, not in lease value.
- INV-8. Reverse match on the listing page: open CRM clients whose requirement this unit fits, using the same engine as section 4.6, each with its score and a share button. Clients it nearly fits are counted as close.
- INV-9. Compare up to 4 units side by side, with the best value in each row marked. A fifth unit can't be added until one is removed.
- INV-10. Shortlist: any user can star units. The shortlist is personal, and a filter shows only starred units.
- INV-11. Share: WhatsApp-ready text for up to 3 units in English, Hindi or Odia, plus a copy button.
- INV-12. Status workflow: Available → Under negotiation → LOI signed → Leased. A deal that falls through returns the unit to Available with a reason. A leased unit can be re-listed as Available with a new available_from date.
- INV-13. Every change to a unit field writes an audit entry: unit, field, old value, new value, who, when and through which channel (app, sheet, owner reply).
- INV-14. Freshness badge per unit: Fresh (confirmed 0 to 7 days ago), Aging (8 to 14 days), Stale (more than 14 days).
- INV-15. Weekly owner check: one WhatsApp message per owner, listing each of their Available units, sent on the configured day (default Monday 10:00). Text for one unit: "Hi [name], is Unit 4B (2,400 sq ft, Sunrise Tech Park) still available on the same terms? Reply 1 if yes, 2 if something changed, 3 if it is leased."
- INV-16. Reply 1 sets last_confirmed to today and confirmed_via to "WhatsApp reply". Reply 2 or 3 sets a data_flag ("Owner reported a change on [date]. Call before offering."), creates a high-priority call task for the listing agent, and stops the unit going out automatically. A reply of 3 sets status to Leased only after the listing agent confirms it on a call.
- INV-17. No reply in 48 hours: one reminder. No reply after 96 hours: a call task for the listing agent.

**Business rules**

- Only units with status Available go to occupiers.
- A unit not confirmed for 14 days drops out of matching until someone confirms it (setting: freshnessDays = 14).
- A unit with a data_flag is never sent automatically. A person checks it first.
- Owner phone numbers are used only for availability checks and owner reports.

Cost calculator example, unit LC-001 (2,400 sq ft chargeable, 1,910 sq ft carpet, so loading is 26%; ₹58 rent, ₹9 CAM, 18% GST, 8 months deposit, 45 rent-free days, 5-year term, rent up 5% each year). Columns: what is worked out, how, and the figure the demo shows.

| Line | Calculation | Result |
|---|---|---|
| Monthly rent | 58 × 2,400 | ₹1,39,200 |
| Monthly CAM | 9 × 2,400 | ₹21,600 |
| Deposit | 8 × 1,39,200 | ₹11,13,600 |
| Move-in cost, before GST | 11,13,600 + 1,39,200 + 21,600 | ₹12,74,400 |
| GST on the first month | 18% × (1,39,200 + 21,600) | ₹28,944 |
| Move-in cost, with GST | 12,74,400 + 28,944 | ₹13,03,344 |
| Rent-free saving | 1,39,200 × 45 ÷ 30 | ₹2,08,800 |
| Total lease value, 5 years, before GST | Rent for 5 years with the 5% rises, less the rent-free saving, plus CAM of 21,600 × 60 | ₹1,03,17,214 |
| Effective all-in over the term | 1,03,17,214 ÷ (60 months × 2,400 sq ft) | ₹71.65/sq ft |

**Demo compared with production.** Demo: 50 sample units (Bhubaneswar 23 including 4 on the Cuttack-Puri bypass, Cuttack 9, Puri 6, Jatni 5, Trisulia 4, Phulnakhara 3). Photos are illustrations and floor plans are schematic. Owner replies are simulated and the check runs when someone clicks it. In the demo, a reply of 2 opens a high-priority call task and sets a data_flag, which a person clears by confirming on a call; a reply of 3 marks the unit Leased at once, and an owner who does not reply gets a call task, with no 48-hour reminder. Production adds the client's cleaned inventory, real photos, floor plans and video, real WhatsApp sends, and INV-16 and INV-17 as written.

### 4.2 Google Sheet sync

**User stories**

- As a leasing executive, I want to keep editing inventory in a Google Sheet, so the team doesn't learn a new tool to update units.
- As a leasing manager, I want to see what will change before it changes.

**Functional requirements**

- SYNC-1. The Google Sheet is the editing surface for unit fields. Header row and column names follow the 72-field template.
- SYNC-2. unit_id is the key. A row without unit_id is skipped and reported by row number.
- SYNC-3. Validation per row: list fields must hold an allowed value, numbers must parse, dates must be YYYY-MM-DD. Errors are listed by row and field. Rows with errors are skipped; the rest can still be applied.
- SYNC-4. Diff preview before anything is applied: units added, units changed (each field with old and new value), units missing from the sheet, and a count of units unchanged.
- SYNC-5. A unit missing from the sheet is marked Leased, never deleted. Its history stays.
- SYNC-6. If more than 10% of units would be marked Leased in one run, the preview asks for a typed confirmation. This guards against a deleted or filtered sheet.
- SYNC-7. Applying a diff writes one audit entry per changed field ("by [user] via Google Sheet") and one sync run record.
- SYNC-8. Production: Google Sheets API polled every 5 minutes, or an Apps Script trigger that calls a webhook on edit. Clean runs (no removals, no errors) apply automatically; any other run waits in the preview for a person.
- SYNC-9. Production: app-owned fields (last_confirmed, confirmed_via, status from owner replies, data_flag) are written back to the sheet. If a field changed in both places since the last sync, the preview shows both values and a person picks one.

**Demo compared with production.** Demo: on the published page, live sync reads the sheet through the Google Drive connector, only when someone clicks. It finds a sheet titled "Leasify Commercial Inventory" or takes a pasted sheet link. Elsewhere, the user pastes the sheet or uploads a CSV, or loads a sample edited sheet. Sync is one way, sheet to app. A column missing from the sheet leaves that field unchanged, and a repeated unit_id uses the last row. The demo does not yet run the SYNC-3 checks or the SYNC-6 guard. Production adds them, polling or an Apps Script webhook every few minutes, and write-back with conflict handling.

### 4.3 Lead ingestion and the WhatsApp leasing agent

**User stories**

- As an occupier, I want a useful reply within a minute, in my language, without filling a long form.
- As a leasing executive, I want the agent to collect the basics and book the visit, so my first call is about the space, not about the requirement.

**Sources and how each connects**

| Source | How it connects |
|---|---|
| 99acres, Magicbricks, Housing.com | The portal's lead email or lead export, parsed on arrival; the portal's lead API where the client's plan includes one |
| JustDial | Lead email or lead export, parsed on arrival |
| Website form | Webhook from the form |
| Meta lead ads | Meta lead ads webhook |
| Google Ads | Lead form webhook |
| Office WhatsApp | Direct, through the WhatsApp Business API |
| Phone call (IVR) | Webhook from the IVR provider on each call; missed calls get a WhatsApp template |
| Referral, Walk-in | Entered by the team in the CRM in one step |

**Functional requirements**

- AGT-1. Every new lead is checked against open clients by phone number first (rule H9).
- AGT-2. First reply within 60 seconds of the enquiry arriving, at any hour.
- AGT-3. Consent first. When we message first (portals, ads, IVR), the first message is an approved template that says what we'll send and asks the occupier to reply to continue. When the occupier messages first, the first reply carries a short notice. Consent is stored (phone, name, channel, notice text, time) before any qualifying question.
- AGT-4. Replies in the language the occupier writes in: English, Hindi or Odia.
- AGT-5. Qualifying questions, only for fields not yet captured, in this order: type of use, size, budget including maintenance, area, move-in date, fit-out need, parking. Every reply is parsed for all fields, so nothing answered is asked again.
- AGT-6. At most 8 questions per conversation (maxQuestions = 8). An unreadable answer is asked again once, in simpler words. A second unreadable reply triggers H7.
- AGT-7. A lead is Qualified once use, size, budget and area are captured. The CRM stage moves at that moment.
- AGT-8. Once qualified, and once every field is asked or skipped, the agent sends the top 3 units that fit every must-have. Each is a card with a photo, all-in ₹/sq ft and monthly, size, fit-out, available date and fit score. Production adds the floor plan where one exists.
- AGT-9. Factual questions are answered from the unit record only. The demo answers photos, location (map link), GST, deposit, lock-in and term, maintenance and parking. Anything else gets "I don't want to guess, so I'll note it for your visit." Production adds area, rent, escalation, power backup, permitted use and available date, and turns an empty field into a task.
- AGT-10. Visit booking: up to 3 open slots (11:00, 15:00 or 17:00) over the next 4 days, no Sundays, skipping slots already booked for that unit. Booking triggers H8.
- AGT-11. No reply in 24 hours: one nudge. At 72 hours: a second. At 96 hours the chat closes and the lead goes on the area agent's call list. Nudges outside WhatsApp's 24-hour service window use approved templates.
- AGT-12. Nurture: move-in more than 90 days away, or the occupier paused. Check-ins at days 14, 30, 60 and 90. A new unit that passes every must-have with a score of 60 or more is sent at once. Thirty days before move-in, the agent re-confirms the requirement and the client returns to Qualified.
- AGT-13. Dead-lead revival: a lead that never replied after the call list, or a client lost as "No response after 3 follow-ups" or "Requirement on hold", gets one message at 30 days and one at 60 days, only if a new matching unit exists. No reply closes it.
- AGT-14. STOP or "unsubscribe" ends all messages, cancels queued nudges, records the withdrawal in the consent log and closes the lead.
- AGT-15. At most one nurture or revival message per client in any 14 days.
- AGT-16. Lead status is one of: ai, handoff, human, booked, nurture, closed.
- AGT-17. The inbox lists conversations with source, language, status, SLA time left and time since last message. Tabs filter by status, and search finds a name, company or phone. Each conversation shows the requirement so far, questions asked and rules fired.
- AGT-18. Concurrency: 30 live conversations from one simulator run in the demo, more with "Add 1 lead"; hundreds in production (section 6).

**Business rules**

- The agent qualifies and books. It never negotiates, confirms terms or gives legal advice.
- It never sends a flagged, stale or non-Available unit.

**Demo compared with production.** Demo: a lead simulator starts 30 chats from all 11 sources, 60% English, 25% Odia and 15% Hindi. The occupiers are 13 kinds, from cooperative to vague, upset, slow, large, far-off or already a client. A "test as an occupier" chat talks to the same agent. The agent is rule-based in all three languages and does not call Claude. It replies 1 to 2 seconds after each message. Waits run on a compressed demo clock: at 1x, 24 hours of silence takes about 25 seconds and the 15-minute SLA about 90 seconds; 3x and 6x run faster. Sends are simulated. Consent is a STOP line in the first reply, logged at once. STOP closes the chat, writes the withdrawal to the consent log and moves the client to Lost. Nurture check-ins, revival messages and AGT-15 are not simulated. The Hindi and Odia lines are drafts that need a native speaker's review. Production adds real source connectors, the hosted model for replies, and the WhatsApp Business API with Meta-approved templates.

### 4.4 Handoff rules

Nine rules decide when a person takes over. Each can be switched on or off in Settings. All are on by default.

| Id | Name | Trigger | Action |
|---|---|---|---|
| H1 | Price negotiation | Occupier asks for a discount, a lower rent or a final price. | Hand to the area agent. AI stops replying on price. |
| H2 | Legal or agreement terms | Questions on the agreement, registration, stamp duty, GST invoices, TDS or clauses. | Hand to the area agent. |
| H3 | Complaint or upset occupier | Complaint, abuse or frustration words. | Hand to the senior manager, priority. |
| H4 | Asks for a person | "Call me", "talk to someone", "are you a bot". | Hand to the area agent for a call within the SLA. |
| H5 | Large deal | Requirement above 5,000 sq ft or above ₹5 lakh a month all-in. | Senior manager takes over after qualification. |
| H6 | No good match | Best match scores under 60, or no unit passes the must-haves. | Agent looks for off-market or upcoming units. |
| H7 | Agent not understood twice | Two replies in a row the agent cannot read. | Hand to the area agent. |
| H8 | Visit booked | A site visit is booked. | Person calls the day before to confirm. AI keeps the chat open. |
| H9 | Existing client | Phone number already belongs to an open client. | Route to the client's current agent; no new lead created. |

**Functional requirements**

- HO-1. Assignee logic. The area agent is the team member who covers the requirement's city, speaks the occupier's language, and has the fewest open clients. If nobody covers the city, the whole team is the pool. H3 and H5 go to the senior manager. H9 goes to the client's current agent.
- HO-2. H5 tests: size uses the middle of the requested range (or seats × 70 sq ft; 75 for coworking); money uses the monthly budget, or budget per sq ft × the size mid-point. Example: 4,000 to 6,000 sq ft at ₹90 all-in is 5,000 × 90 = ₹4,50,000 a month, so H5 does not fire.
- HO-3. Each handoff creates a queue item with rule, reason, priority, assignee, time raised and SLA due time. H3 and H5 are high priority; the rest are normal.
- HO-4. SLA: 15 minutes inside staffed hours, 9:00 to 20:00 (settings). A handoff raised outside staffed hours is due 15 minutes after the next opening time.
- HO-5. The queue is sorted by priority, then by SLA due time. Items past their SLA turn red and appear on the dashboard's needs-attention list.
- HO-6. AI after handoff: the agent sends one holding message that names the person and says they will call within 15 minutes (production: the opening time out of hours). While the lead waits, it still answers fact questions (AGT-9) and acknowledges anything else once. H5 fires as soon as use, size, budget and area are captured. H6's message says the team is looking for off-market and upcoming units. H8 is not a handover: the AI keeps the chat and a call task is created. H9 creates no new client.
- HO-7. Take over: any team member with access can take over a chat from the inbox. The agent then stays silent.
- HO-8. Hand back: the team member returns the chat. The agent resumes from the current requirement without repeating answered questions.
- HO-9. Every rule that fires is recorded on the lead (rulesFired) and in the client's timeline.
- HO-10. Rules also fire in these cases: H4 when no visit slot is free or the occupier asks to change a booked visit; H6 when the occupier rejects every option; H7 when a unit choice or a visit time can't be read twice, or the requirement isn't captured within 8 questions. A rule that is switched off gets a polite fixed reply, and the agent carries on.

**Demo compared with production.** The demo fills the queue live from simulated chats. A simulated team picks leads up after a random wait, so some go past SLA; a toggle turns this off. The demo lists high-priority items (H3, H5) first, then oldest first, and runs the SLA around the clock. Production adds staffed hours, alerts to the assignee and escalation to the senior manager 15 minutes past SLA.

### 4.5 Requirement capture

**User stories**

- As a leasing executive, I want to paste call notes or forward a voice note and get a filled requirement, so I don't retype anything.

**Functional requirements**

- REQ-1. Six ways in: type into the form, paste text (chat, email, call notes), speak into the microphone, upload a voice note, upload a document (PDF, Word, text), or upload an image of a written requirement.
- REQ-2. Voice is transcribed, documents and images are read to text, then all text is parsed.
- REQ-3. A deterministic parser extracts the schema fields below from English, Hindi and Odia, including Hindi and Odia numerals, lakh and thousand amounts, size ranges and month names.
- REQ-4. When the hosted model is available (Claude in the demo), a person can ask it to extract the same fields as structured data. Every value it returns is checked against the allowed lists and ranges before it fills the form. Production highlights fields where the model and the parser disagree.
- REQ-5. Review: the result shows as a filled form, with chips for what was found and a "still to ask" list in the agent's question order. The match updates as the form changes. Nothing is saved to a client until a person clicks Save, with an optional reason that goes into the requirement history.

**Requirement schema**

| Field | Meaning |
|---|---|
| use | Office, Coworking, Retail, Showroom, F&B, Clinic, Institutional, Warehouse or Industrial |
| sizeMin, sizeMax | Chargeable area range in sq ft |
| seats | Seat or team count, used when no area is given |
| budgetPsf | All-in budget per sq ft (rent plus maintenance) |
| budgetMonthly | All-in budget per month, used when no per sq ft figure is given |
| city, localities | City and one or more requested localities |
| landmark | Named landmark with location, used for distance |
| radiusKm | Search radius. Default 3 km; 10 km for Warehouse and Industrial |
| moveIn | Date the occupier wants to start using the space |
| furnishing | Condition needed on day one: Bare shell, Warm shell, Semi-furnished or Plug-and-play |
| parking4w | Car parks needed (0 means none) |
| powerBackup | "100%" when full backup is a must-have |
| frontageMin | Minimum road frontage in feet (shops, showrooms) |
| groundFloor | True when ground floor is a must-have |
| clearHeightMin | Minimum clear height in feet (warehouses, sheds) |
| mustHave | Named amenities that are must-haves, for example Lift, Fire NOC, Main road facing, Loading dock |
| leaseYears | Preferred lease term |
| company, contactName | Who the requirement belongs to |
| notes | Anything else |

**Interpretation rules**

| Input | How it is read |
|---|---|
| A single size, "about 2,000 sq ft" | Range 0.85x to 1.15x: 1,700 to 2,300 sq ft |
| "At least 2,000" or "2,000+" | 2,000 to 2,600 (1.3x) |
| "Up to 2,000" | 1,400 (0.7x) to 2,000 |
| Only seats, for example 30 seats | Mid-point 30 × 70 = 2,100 sq ft (75 per seat for coworking); range 0.85x to 1.2x: 1,785 to 2,520 sq ft |
| Monthly budget only, ₹1.5 lakh for 2,000 sq ft | 1,50,000 ÷ 2,000 = ₹75/sq ft all-in |
| "Immediately", "asap" | Move-in 10 days from today |

**Demo compared with production.** The demo has four ways in: type or paste (with six sample messages), speak, voice note and document. Speak uses the browser's speech API (Chrome, with English, Hindi or Odia picked). An uploaded voice note plays but is not transcribed: the user types what was said, or picks one of three sample voice notes, which are transcripts only. Text files (.txt, .eml, .md, .csv, .json) are read in the browser, images only with Claude, and PDF and Word files not at all. Production adds server-side transcription of WhatsApp voice notes and reading of documents and images.

### 4.6 Requirement match

The engine is ported from a renter match running at a US leasing operation: same rules, commercial factors. The client asked for a "renter match"; in commercial leasing it is a requirement match, because the people searching are occupiers.

**Rules**

1. Must-haves are hard filters. A field we don't know never passes a must-have. For example, a unit with no parking count recorded fails a "3 car parks" must-have.
2. Flagged units are never sent automatically. A person checks them first.
3. Rank what passes. Show near misses separately, with exactly what they miss.

**Exclusion rules**

| Key | Label | Definition |
|---|---|---|
| status | Not available | Status is not Available (under negotiation, LOI signed or leased). |
| stale | Not confirmed in 14 days | Owner has not confirmed availability and terms in the last 14 days. |
| use | Use not permitted | The building does not allow this type of use. |
| size | Size out of range | Chargeable area more than 20% outside the requested range. |
| budget | Over budget | All-in cost per sq ft more than 10% over the budget. |
| location | Outside the area | Not in the requested localities and further than the search radius from them. |
| specs | Missing a must-have | Lacks a stated must-have: parking count, 100% backup, ground floor, frontage, clear height or a named amenity. |
| ready | Not ready in time | Cannot be ready more than 45 days after the move-in date. |
| flag | Flagged for checking | Unit carries a data flag (for example, fire NOC not on file for food, clinic or education use). Never sent automatically. |

**Scoring factors**

| Key | Factor | Weight | Definition |
|---|---|---|---|
| budget | All-in cost | 30 | Rent + maintenance per sq ft against the stated budget. 100 at or under budget, falls 5 points per 1% over, 0 at 20% over. |
| size | Size | 20 | Chargeable area against the requested range. 100 inside the range, falls 3 points per 1% outside it. |
| location | Location | 20 | 100 in a requested locality or within 1 km of the requested landmark, falling to 0 at 1.5x the search radius. City-only requests score 70 for any unit in that city. |
| ready | Ready by move-in | 15 | Date the occupier can trade (available date plus fit-out weeks to reach the condition they need) against their move-in date. 100 on time, minus 2 points per day late. |
| specs | Specs | 10 | Share of these the unit has: requested parking, 100% power backup, lift (upper floors), fire NOC, occupancy certificate. |
| fresh | Data freshness | 5 | 100 if the owner confirmed in the last 3 days, 80 within 7, 50 within 14. |

**Functional requirements**

- MAT-1. Units failing status, stale or use are removed first and never shown as close options.
- MAT-2. For the rest, each of size, budget, location, specs, ready and flag is checked. Zero misses: "Fits every must-have". Exactly one miss: "Close option", shown with what it misses. Two or more: excluded.
- MAT-3. Match score = sum of (factor score × weight) ÷ 100, rounded. Weights add to 100.
- MAT-4. When a field is missing from the requirement, the factor takes a neutral score: size 70, budget 70, location 60, ready 80.
- MAT-5. Fit-out time to reach the condition the occupier needs, in weeks: Bare shell 10, Warm shell 6, Semi-furnished 2, Plug-and-play 0, each measured to plug-and-play. Gap = weeks for the unit's condition minus weeks for the needed condition, when the unit is less finished. Example: unit is bare shell, occupier needs warm shell, gap = 10 − 6 = 4 weeks. Ready date = later of today and available_from, plus the gap.
- MAT-6. Ranking: score high to low, then all-in ₹/sq ft low to high, then most recently confirmed.
- MAT-7. Units not shown are counted by reason, each once, under the first rule it failed. Close options are listed on their own, not in these counts.
- MAT-8. Each result shows the score, each factor's score with a note, and a short reason ("Strong on all-in cost, size, location" or "Misses: over budget").
- MAT-9. Google Maps directions links from each unit to the requested locality or landmark. No paid map API.
- MAT-10. Share text for up to 3 units, in English, Hindi or Odia.
- MAT-11. A known-gaps note says plainly what the data does not know (for example, how many available units have no frontage or clear height on file), and when nothing fits, which rule left out the most units.
- MAT-12. A match can start from a CRM client, a lead, or a requirement typed on the match screen.

**Worked example.** Requirement: Office, 2,000 to 2,600 sq ft, ₹70/sq ft all-in, Patia, move in by 1 December, warm shell, 3 car parks. Unit LC-001: 2,400 sq ft, all-in ₹67, in Patia, warm shell, available 8 January, 4 car parks, 100% backup, lift, fire NOC and occupancy certificate on file, confirmed 6 days ago. Columns: the factor, its score out of 100, the reason, its weight (points out of 100), and the two multiplied.

| Factor | Score | Why | Weight | Score × weight |
|---|---|---|---|---|
| All-in cost | 100 | ₹67 is under ₹70 | 30 | 3,000 |
| Size | 100 | 2,400 is inside 2,000 to 2,600 | 20 | 2,000 |
| Location | 100 | In Patia | 20 | 2,000 |
| Ready by move-in | 24 | Ready 8 January, 38 days late: 100 − 38 × 2 | 15 | 360 |
| Specs | 100 | 5 of 5 checks | 10 | 1,000 |
| Data freshness | 80 | Confirmed 6 days ago, within 7 | 5 | 400 |
| **Total** | | | 100 | 8,760 ÷ 100 = **88** |

LC-001 still fits every must-have, because 38 days late is inside the 45-day limit. With a move-in of 1 January it would be 7 days late, scoring 86 on that factor and 97 overall.

**Demo compared with production.** The same engine runs in both. In the sample data, LC-035 (a food unit on VIP Road, Puri, with no fire NOC on file) is flagged, so it appears only as a close option marked "Check before offering". An owner who replies 2 also flags the unit until a person confirms it on a call. Production runs the engine on the server and logs every shortlist sent.

### 4.7 Leasing co-pilot

**User stories**

- As a leasing executive, I want to ask "what fits a 2,500 sq ft clinic in Patia by March?" and get an answer from live data.
- As a leasing manager, I want the co-pilot to refuse what it can't answer from defined data, so it never makes up a number.

**Intents in the demo.** Columns: the intent, a question that triggers it, and the data the answer comes from.

| Intent | Example | Data used |
|---|---|---|
| Find space | "What fits a 2,500 sq ft clinic in Patia, ready by March?" | Requirement match |
| Follow-ups | "Which enquiries haven't been followed up in 5 days?" | CRM timeline |
| Compare units | "Compare LC-001, LC-005 and LC-008" | Inventory |
| Term sheet | "Draft the term sheet for LC-001" | Inventory, CRM |
| Visited but no offer | "Which units have had visits but no offer?" | Visits, stages |
| Unit visit history | "Who visited LC-007 this month and what did they say?" | Visits |
| Stuck clients | "What's stuck in the pipeline?" | Stage history |
| Visits | "Which visits tomorrow aren't confirmed?" | Visits |
| Stale units | "Which units haven't been confirmed in 14 days?" | Freshness |
| Sources | "Which source brings signed leases?" | Source to close |
| Market rents | "What's the average all-in rent for offices in Patia?" | Inventory |
| Days vacant | "Which available units have been vacant the longest?" | Inventory |
| Workload | "Show Priyanka's open clients" | CRM, tasks |
| Handoffs | "Who is waiting for a person?" | Handoff queue |
| Client brief | "Brief me on Finlogic IT Services" | CRM, visits |

A unit id on its own ("LC-001") returns that unit's key facts. Production adds pipeline counts and the no-show rate.

**Functional requirements**

- COP-1. Known questions are routed by rules to code that computes the answer from named data. No free-form database queries.
- COP-2. Every answer names the data it used and the written definition behind any number, and links to the units and clients behind it.
- COP-3. A question that maps to no intent gets: "I can't answer that from the data I have. I've noted it for a person on the team." A task is created for the user, with three questions the co-pilot can answer.
- COP-4. Term sheet draft: owner, occupier, premises with carpet and chargeable area and loading, permitted use, rent, CAM, GST, deposit, term and lock-in, escalation, rent-free days, handover condition and available-from date, parking, power load and backup, stamp duty and notice period as placeholders to confirm, a 15-day validity, and the line "Draft for discussion only. Not a binding offer." The team copies the text and edits agreed values, such as a negotiated lock-in, before sending.
- COP-5. The co-pilot never sends anything. A person reviews and sends.
- COP-6. The co-pilot sees only what the user's role allows (section 2).

**Demo compared with production.** The demo routes questions with rules. When no rule matches and Claude is available, Claude answers using five read-only page tools (units, a client, pipeline counts, visits, lead sources), tagged "Claude"; otherwise COP-3 applies. Voice questions use the browser's speech API in English or Hindi. Roles are not enforced. Production logs every question, intent and answer for weekly review.

### 4.8 CRM

**User stories**

- As a leasing manager, I want one record per client showing the requirement, every unit shared, every visit and every change, and where the deal is stuck.

**Stages**

| Stage | Definition |
|---|---|
| New enquiry | Any first contact about a space requirement, from any source. |
| Qualified | Use, size, budget and area are captured. |
| Site visit | At least one visit has taken place, marked by the team after it happened. |
| Proposal | Written options or terms sent to the occupier. |
| Letter of intent | The occupier has signed a letter of intent. |
| Signed lease | The lease agreement is executed. |
| Nurture | Real requirement, but move-in is more than 90 days away or the occupier paused. |
| Lost | Closed without a lease. Reason recorded. |

**Functional requirements**

- CRM-1. Client record: name, company, phone, email, source, language, assigned agent, stage, requirement, units shared (with channel and reaction), visits, next follow-up, notes, tags, consent status, unit signed, achieved rent and brokerage.
- CRM-2. Requirement history with field-level changes: each change shows the field, old value, new value, who, when and why. Example: "Budget ₹65 → ₹72/sq ft, Priyanka Das, 3 Oct, raised budget after first visit."
- CRM-3. Stage history: every move with date and who made it. Days in each stage = date of the next move minus date of entering the stage, or today for the current stage.
- CRM-4. Board view (one column per stage, cards can be dragged) and list view. Filters for stage, agent, source, city, use and language, and search by name, company or phone. Sort by last updated, created, next follow-up or days in stage.
- CRM-5. Timeline per client: created, messages, requirement changes, units shared, visits, documents, stage moves, notes.
- CRM-6. Tasks: follow-up, confirm visit, chase proposal, nurture check-in, owner check. Each with due time, assignee and priority.
- CRM-7. Duplicate check: phone numbers are stored as +91 followed by 10 digits. A new lead with the phone of an open client (any stage except Lost and Signed lease) joins that client (rule H9). A possible duplicate by email or company name is suggested for merge; a person confirms. A merge keeps the older record and combines timelines.
- CRM-8. Source attribution: source to close credits the first source. Later sources are kept on the record.
- CRM-9. Lost needs a reason from the list: Chose another broker; Budget too low for the area; Requirement on hold; Took a unit directly from owner; No response after 3 follow-ups; Location did not work.
- CRM-10. Brokerage tracking for deals at Letter of intent and Signed lease: expected brokerage = achieved rent ₹/sq ft × chargeable sq ft × brokerage months. Status: expected, invoiced, received. Example: ₹56 × 2,400 × 1.5 = ₹2,01,600.

**Demo compared with production.** The demo seeds 96 sample clients over 70 days. It checks duplicates by phone only (the same last 10 digits as an open client), keeps one source per client, and shows deal value, achieved rent and brokerage for signed leases without an invoice status. Production adds CRM-7 email and company merges, CRM-8, the CRM-10 status, and import of the client's existing list.

### 4.9 Site visits

**User stories**

- As a leasing executive, I want every booked visit to come with a confirmation call task, so no visit is a surprise.

**Functional requirements**

- VIS-1. Book from the WhatsApp agent, CRM, match screen or listing page. The form offers up to 4 open slots (11:00, 15:00 or 17:00) over the next 4 days, no Sundays, or a custom time. Slots already booked for that unit are not offered.
- VIS-2. Calendar by day and week, filterable by agent, city and unit.
- VIS-3. Every booking creates a "Confirm visit" call task (H8), due 24 hours before the visit (or 5 minutes from now if the visit is sooner), high priority, for the client's agent.
- VIS-4. Confirmation is Pending or Confirmed; a visit is Booked, Done, No-show or Cancelled. Confirmed closes the call task. Rescheduling books the new time and cancels the old one.
- VIS-5. WhatsApp reminder to the occupier on the morning of the visit, with address and Google Maps link.
- VIS-6. Outcome: Done or No-show. Done needs feedback, a 1 to 5 rating, a next step (send proposal, show more units, or not interested with a lost reason) and yes/no for "status and terms matched the record". No-show creates a high-priority call to rebook.
- VIS-7. The first visit marked Done moves the client to Site visit. "Send proposal" moves the client to Proposal and adds a task to send the term sheet.
- VIS-8. No-show rate by week, agent and booking method (AI alone, AI plus confirmation call, team).

**Demo compared with production.** The demo seeds past and upcoming visits with pending confirmation tasks. Its agenda covers the next 7 or past 7 days, filtered by agent. It does not yet ask "status and terms matched the record", send the morning reminder, or split the no-show rate (it shows one rate for the last 30 days). Production adds these and calendar invites for the team.

### 4.10 Owner portal

**User stories**

- As an owner, I want to see what happened with my unit this week without calling the desk.

**Weekly report contents (one per unit)**

- Enquiries in the last 7 and 30 days: clients who were sent the unit, or who visited or booked a visit to it.
- Site visits done in the last 7 and 30 days, with visitor feedback and rating. Occupier names are never shown to the owner.
- Offers: clients at Proposal or later on this unit.
- Days on the market (days since the listing date).
- Last confirmation, next visit, available-from date and the owner's contact at the desk.
- How similar units nearby are moving.
- One suggestion, from the rules below.
- The availability check (reply 1, 2 or 3).

**Similar-units method**

1. Same property type.
2. Within 3 km of the owner's unit. For warehouses and industrial sheds, anywhere in the same city.
3. Units in any status count.
4. The report shows the owner's all-in ₹/sq ft against the median all-in of the similar units, as a percentage above or below, and how many similar units are leased.
5. No similar units: the report says there is nothing to compare yet.

Other owners and their units are never named.

**Suggestion rules.** Units that are Leased, or Under negotiation or LOI signed, get a status line instead. For Available units, the first rule that fits wins. Defaults, to be confirmed with the client. Columns: rule id, when it fires, and what the owner is told.

| Id | When | Suggestion |
|---|---|---|
| S1 | An offer is in hand (a client at Proposal or later on this unit) | Your listing agent will call you to go through the terms. |
| S2 | All-in more than 10% above the similar-unit median, 3 or more visits done, no offer | Visitors compare it with cheaper units nearby. A 60-day rent-free period may close faster than a rent cut. |
| S3 | Not confirmed for 7 or more days | Please confirm availability so we keep showing it. |
| S4 | No enquiries in 30 days | Few enquiries match this size. Allow smaller splits or retail use, if the building permits. |
| S5 | None of the above | Interest is steady. No change needed. |

**Functional requirements**

- OWN-1. The weekly report goes out on the configured day by WhatsApp template, with a PDF link.
- OWN-2. The listing agent reviews each suggestion before the report is sent.
- OWN-3. Owner replies 1, 2 or 3 follow INV-16.
- OWN-4. Owner co-pilot answers about the owner's own units only, from the metrics layer, with the leasing co-pilot's refusal rule. Examples: "How many people asked about my unit this month?", "Why hasn't it leased yet?", "What are similar units nearby getting?"
- OWN-5. Owner chat is switched on per owner, only once that owner reads reports and asks questions.

**Demo compared with production.** The demo shows the report and owner co-pilot for sample owners, with a WhatsApp preview in English, Hindi or Odia and buttons that act as the owner's 1, 2 or 3 reply. The Hindi and Odia text needs a native speaker's review. The owner co-pilot answers about enquiries, visits, feedback, the next visit, similar units, why a unit hasn't leased, and whether its details are current; Claude answers other questions from the owner's own data when available. Production sends real reports in Phase 3, then turns on owner chat.

### 4.11 Dashboard and analytics

**Functional requirements**

- DSH-1. Tiles: new enquiries today (and in the last 7 days), live AI conversations, waiting for a person (and how many are past SLA), visits today (confirmed and pending), proposals out, and available units (and how many are not confirmed in 14 days). Each tile shows its definition on hover. Production adds a period choice and tiles for every metric in section 3.
- DSH-2. Pipeline for clients created in the last 30 days: the count that reached each stage, with conversion from the stage before. Conversion = clients reaching this stage ÷ clients reaching the stage before.
- DSH-3. The enquiry to signed lease rate for the same 30 days.
- DSH-4. Needs-attention list, most urgent first, up to 8 items, each with a one-click link. Columns: rule id, the rule, and whether the demo shows it today or production adds it.

| Id | Rule | Where |
|---|---|---|
| NA1 | Handoff waiting, past its 15-minute SLA first | Demo |
| NA2 | Visit confirmation call due today or overdue | Demo |
| NA3 | Client task overdue (follow-up, proposal, call list) | Demo |
| NA4 | Client in the same stage for more than 10 days | Demo |
| NA5 | Available units not confirmed for more than 14 days | Demo |
| NA6 | Proposal with no activity for 7 days | Production |
| NA7 | Available unit with 3 or more visits in 30 days and no proposal | Production |
| NA8 | Owner replied 2 or 3 and the unit is not yet updated | Production |

- DSH-5. Analytics for the last 7, 30 or 70 days: enquiries per week and by source; funnel by stage; source to close (sources under 10 enquiries marked low n); first human contact and first AI reply by agent; visits done, no-show rate, visits per signed lease and average rating; available sq ft by city, freshness bands and the 15 longest days vacant; asking against achieved per signed lease; team table; lost reasons; conversations by status and handoffs by rule. Production adds no-show rate by week and booking method, and first reply time by week.
- DSH-6. Every chart names its metric and definition and shows its n. Unit bars and rows open the listing.
- DSH-7. Live activity feed of stage moves, visits, handoffs and syncs.

**Demo compared with production:** the demo computes everything from seeded and simulated data. Production computes from the database through the defined metrics layer, with CSV export.

### 4.12 Settings

**Functional requirements**

- SET-1. Areas: cities and localities with location and search aliases (including Hindi and Odia spellings), managed as settings.
- SET-2. Languages: English, Hindi, Odia on by default.
- SET-3. Lead sources: add, rename or switch off a source; set how it connects.
- SET-4. Rules and thresholds, each editable with its default shown:

| Setting | Default |
|---|---|
| freshnessDays (drop-out after) | 14 days |
| slaMinutes | 15 minutes |
| staffedHours | 9:00 to 20:00 |
| nudgeHours | 24 and 72 hours |
| largeDealSqft (H5) | 5,000 sq ft |
| largeDealMonthly (H5) | ₹5,00,000 |
| minMatchScore (H6) | 60 |
| maxQuestions | 8 |
| Handoff rules H1 to H9 | All on |

- SET-5. Team and access: add users, set role, cities covered, languages spoken, and senior flag.
- SET-6. WhatsApp templates: list of every template with language, status (draft, submitted, approved, rejected) and Meta's reason when rejected. All templates are submitted in week 1.
- SET-7. Consent log: phone, name, channel, notice text, time given, time withdrawn. Searchable, exportable by admin.
- SET-8. Audit log: every change to unit terms, settings and rules, with who and when.
- SET-9. Integrations: WhatsApp provider, Google Sheet link and sync mode, lead source connectors, language model, IVR.
- SET-10. Every settings change writes an audit entry.

**Demo compared with production.** In the demo, settings changes apply at once but are not written to the audit log. Staffed hours and nudge hours can be edited but nothing uses them yet: the simulator nudges at a fixed 24 and 72 hours and runs the SLA around the clock. Templates show as Approved or Pending. Production applies every setting and logs every change.

### 4.13 CEO co-pilot

**Purpose.** Give the agency's owner the business in plain numbers (money, forecast, team, sources, demand against supply, risks) and say what to act on this week. The leasing co-pilot (4.7) serves agents; this one serves the CEO. Same guardrail: answers come only from named data and written definitions. If a question doesn't map to one, it says so.

**User stories**
- As the CEO, I see this week (or month) against the last one in one card, with a short written brief.
- As the CEO, I ask "what should I focus on this week?" and get three to five ranked actions, each with the number behind it.
- As the CEO, I see where occupier demand is higher than our supply, so I know which units to source.

**Definitions.** Columns: term, how it is worked out.

| Term | How it is worked out |
|---|---|
| Brokerage earned | Brokerage on leases signed in the period: achieved monthly rent x the unit's brokerage months. |
| Expected brokerage (open deal) | Monthly rent of the deal's unit (or the client's top exact match) x that unit's brokerage months. |
| Weighted pipeline | Sum over open clients of expected brokerage x stage probability. Planning assumptions: Qualified 10%, Site visit 25%, Proposal 45%, Letter of intent 80%, others 0%. Adjustable in Settings. |
| 30/60/90-day forecast | Weighted pipeline split by the client's move-in date. |
| Demand against supply | Open clients grouped by use and city or locality, against available units of that use there and the units that pass every must-have for each client. |
| Period | This week = last 7 days; this month = last 30 days (rolling). |

**Functional requirements**
- CEO-1. Brief card: enquiries, qualified, visits done, proposals, LOIs, signed leases, brokerage earned, weighted pipeline, median first AI reply, median first human contact; each with change against the previous period and n shown when small.
- CEO-2. Four to six written brief lines built by rules from the numbers: biggest change, money and pipeline, best source, biggest deal, main risk, one suggested action.
- CEO-3. Questions it answers: how we are doing; brokerage earned; forecast; biggest deals; stuck deals; team scorecard and one agent's numbers; lead sources (states that ad spend is not in the system yet, so cost per lease can't be worked out); where deals are lost (stage drop-off and lost reasons); demand against supply with sourcing targets; units to push (days vacant, visits without offer); speed and service; inventory health; owners who bring the most business; focus list; period comparison; help.
- CEO-4. Focus rules (ranked): a large Proposal or LOI deal stuck over 10 days; a demand gap; an agent with 3 or more overdue follow-ups; 3 or more stale units; a source with enquiries but few visits; handoffs past SLA; a long-vacant unit with visits but no offer; qualified clients with no visit for over a week.
- CEO-5. Every answer has a lead sentence with the key number, a table or list, buttons to open the client, unit or screen, and a source line naming the data and definition.
- CEO-6. Questions outside the rules go to Claude with read-only tools (business summary, pipeline deals, team scorecard, source stats, demand and supply) when available; otherwise the co-pilot says it can't answer yet and lists what it can.

**Demo compared with production.** The demo builds every number live from the sample data. Several open clients can share the same top-match unit, so expected brokerage and the pipeline are an upper estimate; the answers say so. Production adds ad spend per source (for cost per lease), editable stage probabilities, and a weekly brief sent to the CEO on WhatsApp or email every Monday.

### 4.14 Sign-in, roles and team report cards

**Purpose.** Each person signs in and sees only what their role needs. The CEO and the leasing manager see how every agent is doing on one report card per agent, built from the work recorded in the system.

**Roles.** Columns: role, who, what they see.

| Role | Who (demo) | What they see |
|---|---|---|
| CEO | Sanjeev Das | Every screen, including Settings and every report card |
| Leasing manager | Rohit Mohanty | Everything except Settings; every report card |
| Leasing executive | Priyanka Das, Subham Sahoo, Ananya Patnaik, Satya Prakash Jena | Dashboard (with a "My work" card), lead inbox (with "Assigned to me"), inventory, requirement match, leasing co-pilot, CRM (opens on their own clients), site visits, their own report card only |
| Owner | Any owner | Owner portal only, locked to their own units |

**Functional requirements**
- AUTH-1. Sign-in by phone number or email plus a one-time code (demo: a 4-digit PIN, any PIN works). Every sign-in is logged with time and role.
- AUTH-2. The menu shows only the screens the role can open; opening a blocked screen by link sends the person to their home screen.
- AUTH-3. A user menu shows who is signed in and since when, with switch user and sign out.
- AUTH-4. Everything a person does (timeline entries, visits, tasks, stage moves) is recorded under their name.
- TEAM-1. Leaderboard for the CEO and manager over 7, 30 or 70 days, with an optional comparison against the previous period: overall score and band, signed leases, brokerage earned, proposals, visits done, visit-to-proposal rate, median first human contact, handoffs on time, overdue follow-ups, visit rating, trend.
- TEAM-2. Report card per agent with six scored sections (0 to 100), each showing its inputs and its rule; strengths and focus lines; a 10-week chart of visits and signed leases; lists to act on (overdue follow-ups, deals stuck over 10 days, visits waiting for a confirmation call).
- TEAM-3. A section with no data shows "no data yet" and drops out of the overall score; thin data is marked "low n".
- TEAM-4. The CEO co-pilot answers "show Ananya's report card" by opening it.

**Scoring.** Columns: section, weight in the overall score, how it is scored.

| Section | Weight | How it is scored |
|---|---|---|
| Speed | 20 | First human contact: 100 at 15 minutes or less, falling to 0 at 120. Handoffs: share picked up inside the SLA. Averaged. |
| Follow-up discipline | 20 | 100 minus 10 per overdue follow-up; share of open clients with a follow-up date; share of tasks done on time. Averaged. |
| Site visits | 15 | Share confirmed before the visit; no-shows (100 minus 2.5 per 1%, 0 at 40%); average rating scaled 1 to 5 → 0 to 100. Averaged. |
| Conversion | 20 | Four steps against targets: qualified to visit 60%, visit to proposal 50%, proposal to LOI 50%, LOI to signed 60%. Each step scores rate / target, capped at 100. |
| Revenue | 15 | Brokerage earned against ₹2 L per 30 days; weighted pipeline owned against ₹8 L. Capped at 100, averaged. Targets are planning assumptions. |
| Data quality | 10 | Share of open clients with a complete requirement, with a follow-up date, and with activity in the last 7 days. Averaged. |

Bands: 80 and above Strong, 65 to 79 On track, 50 to 64 Needs support, under 50 At risk.

**Demo compared with production.** The demo opens on a sign-in page with a panel of sample people; any PIN works. Some history behind the cards (past handoff pickups, completed tasks, last sign-in times) is generated sample data and marked "(sample)" where shown. Production adds one-time-code sign-in, session timeouts, role enforcement on the server, editable targets and weights, and a monthly report card sent to each agent and the CEO.

## 5. Data model

| Entity | Key fields |
|---|---|
| Unit | The 72 fields in section 4.1 |
| Owner | id, name, owner_type, phone, preferred language, units, report day, co-pilot on (yes/no) |
| Client | id, name, company, phone, email, source, language, agent, stage, req, shared units, nextFollowUp, lostReason, unitId, achievedPsf, dealValueMonthly, brokerage, consent, tags |
| Requirement | The schema in section 4.5, held on the client and on the lead |
| RequirementChange | clientId, time, from, to, by, why |
| StageChange | clientId, stage, time, by, note |
| Lead (conversation) | id, clientId, name, company, phone, source, language, status, createdAt, lastAt, firstReplyMs, req, matches, visitId, handoff, rulesFired |
| Message | leadId, from (lead, ai, agent, system), text, time, by, unit cards, quick replies |
| Visit | id, clientId, unitId, when, booked by, status, confirmation, agent, feedback, rating, record matched |
| Task | id, type, title, due, clientId, visitId or unitId, assignee, priority, done, doneAt |
| HandoffQueueItem | id, leadId, clientId, rule, reason, priority, assignee, raised at, SLA due, status, picked at, by |
| ConsentRecord | phone, name, channel, notice text, given at, withdrawn at, source |
| AuditEntry | time, entity, record id, field, from, to, by, channel |
| SyncRun | time, source, added, changed, marked leased, errors, by |

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Latency | Median first reply under 60 s, and 95% under 2 minutes (the strategy's day 180 goal). Agent turn reply within 10 s. Match under 1 s for 5,000 units. Dashboard load under 2 s. |
| Concurrency | Demo: 30 or more live conversations. Production: 500 live conversations at once without slowing replies. |
| Availability | 99.5% monthly, measured in staffed hours. The agent keeps replying outside staffed hours. |
| Hosting | Unit, owner and occupier data stored in India. |
| Language model | Hosted model through an API. No training on client data. Only the text needed for the turn is sent; phone numbers are masked. |
| DPDP | Consent before the first message. Notice in plain language. Withdrawal honoured at once. The client is the data fiduciary; MSM processes data on its behalf. |
| Security and access | Role-based access as in section 2. Owners see only their own units. Sign-in with two-step verification for the team. |
| Audit | Every change to unit terms, settings and client stage is logged with who and when. Logs are kept for the life of the contract. |
| Language QA | A native speaker on the client's team reviews every Hindi and Odia template before submission, and a weekly sample of 20 chats. |
| Phone and laptop | Every screen works at 390 px wide, in light and dark modes. |

## 7. Integrations

Lead source connectors are listed in section 4.3. The rest:

| Integration | Use | Phase |
|---|---|---|
| Postgres | System of record | 1 |
| WhatsApp Business API through a provider | Chats, templates, owner checks and reports; templates to Meta in week 1 | 1 |
| Google Sheets API or Apps Script | Inventory sync | 1 |
| Google Maps links | Directions, no paid API | 1 |
| Hosted language model | Replies, extraction, reading co-pilot questions | 1 and 2 |
| Speech-to-text | Voice notes and spoken requirements | 1 |
| Document and image reading | Uploaded requirements | 2 |
| Workflow tool already used on Leasify US | Reminders and routine flows, where it fits | 1 |

## 8. Release plan

| Release | Weeks | Scope | Exit criteria |
|---|---|---|---|
| Demo | 2 weeks before signing | Client's own units loaded, WhatsApp agent, requirement match, the full prototype | Client signs the proposal and statement of work |
| Phase 1 | 1 to 6 | Inventory and sheet sync, owner weekly check, WhatsApp agent with H1 to H9, requirement capture by typing, pasting and voice notes, requirement match, CRM basics, site visits with confirmation calls, pipeline dashboard, consent log, audit log, roles | Units loaded and 85% confirmed in 14 days; agent answering live enquiries; templates approved; no-show tracked |
| Phase 2 | 7 to 12 | Leasing co-pilot with term sheet drafts, CEO co-pilot and weekly CEO brief, analytics, document and image capture, revival campaigns, brokerage reports | Six weeks of real data in the system before start; team uses the co-pilot daily; analytics agrees with CRM counts |
| Phase 3 | 13 to 24 | Weekly owner report, then owner co-pilot | Owners reading reports; owner co-pilot on for owners who ask questions |

## 9. Open questions

1. Is the client a broker, a developer or both? (Changes the owner side.)
2. Can the match code from the US operation be reused for a third party? If not, the logic is rebuilt.
3. Which portals does the client pay for, and which offer a lead API on its plan?
4. Does the client already have a WhatsApp Business number and Meta business verification?
5. Who on the client's side owns the inventory sheet?
6. Which hosting region and language model terms satisfy the client's view of data residency?
7. Should owner reports go to every owner from week 13, or to a pilot group first?
8. Are the suggestion rules S1 to S5 acceptable to say to owners?

## 10. Out of scope for Phase 1

- Leasing co-pilot, analytics beyond the pipeline, owner report and owner co-pilot.
- Document and image requirement capture.
- Native mobile apps.
- AI phone calls.
- Rent collection, invoicing, e-signing and lease management after signing.
- Listing syndication to portals.
- Coworking seat booking.
- Any city beyond Bhubaneswar for this client.
- Model training of any kind.

## Appendix A. Demo script (10 steps)

1. **Dashboard.** Tiles, pipeline, needs-attention list. Hover a tile for its definition.
2. **Inventory.** Offices in Patia under ₹70/sq ft all-in. Grid, map, table. Open LC-001 and run the cost calculator.
3. **Sheet sync.** Change a rent and delete a row in the sheet, or load the sample edited sheet. Preview, apply. The missing unit is marked Leased, not deleted.
4. **Owner check.** Run the weekly check. Two owners reply 2: a call task appears for each and the unit is flagged until a person confirms it. On the first run one owner replies 3 and the unit is marked Leased, and one owner doesn't reply and gets a call.
5. **Lead inbox.** Start the simulator: 30 chats from all 11 sources, each answered in 1 to 2 seconds in English, Hindi or Odia. Explain the demo clock.
6. **Handoffs.** A discount request (H1) and a repeat phone number (H9). Take over, then hand back.
7. **Requirement capture.** Paste call notes, then speak a requirement (in Chrome) or pick a sample voice note. Review the fields.
8. **Requirement match.** Factor scores, a close option, excluded counts, share text.
9. **CRM and visits.** A client's requirement history, days per stage and timeline. Book a visit; show the confirmation call task due the day before.
10. **Co-pilot and owners.** Ask "which units have had visits but no offer?", draft a term sheet, open an owner's weekly report.

## Appendix B. Glossary

| Term | Meaning |
|---|---|
| Carpet area | Usable floor area inside the walls of the unit |
| Super built-up area | Carpet area plus a share of common areas: lobby, corridors, lifts, stairs |
| Chargeable area | The area rent is billed on. Usually equal to super built-up. |
| Loading | Common area added to the billed size, as a percentage of carpet: (super built-up − carpet) ÷ carpet. Example: (2,400 − 1,910) ÷ 1,910 = 26%. |
| CAM | Common area maintenance, charged per sq ft per month on top of rent |
| All-in | Rent plus CAM per sq ft, before GST. The number occupiers compare and the match uses. |
| Lock-in | Months the occupier cannot exit the lease |
| Escalation | Rent increase applied at a fixed interval, for example 5% every year |
| Rent-free | Days at the start of the lease with no rent, usually for fit-out |
| Bare shell | Unfinished space: walls, floor slab, basic services, no interiors |
| Warm shell | Finished floor, ceiling, washrooms and power points; no workstations or cabins |
| Plug-and-play | Fully fitted: furniture, cabling, AC; ready to use on day one |
| LOI | Letter of intent: the occupier's written commitment to the main terms before the lease is signed |
| Mandate | The owner's authority for the desk to lease the unit. Exclusive: only this desk. Open: other brokers too. |
