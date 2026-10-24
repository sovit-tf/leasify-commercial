import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

rows = json.load(open("inventory.json", encoding="utf-8"))
cols = list(rows[0].keys())

DICT = {
 "unit_id": ("Unique unit code. Never change it once set; the demo matches sheet rows to units by this code.", "Key"),
 "listing_title": ("Headline shown on the listing card.", "Text"),
 "property_type": ("Office, Coworking, Retail shop, Showroom, F&B space, Clinic, Institutional, Warehouse or Industrial shed.", "List"),
 "grade": ("Building grade A, B or C (A = newest, best specs and management).", "List"),
 "building_name": ("Building or complex name.", "Text"), "unit_no": ("Unit, floor or bay label inside the building.", "Text"),
 "floor": ("Floor number. 0 = ground floor.", "Number"), "total_floors": ("Floors in the building.", "Number"),
 "city": ("City or town.", "Text"), "locality": ("Locality or micro-market used for search and matching.", "Text"),
 "micro_market": ("One-line description of the area.", "Text"), "address": ("Full address.", "Text"), "pincode": ("PIN code.", "Text"),
 "lat": ("Latitude, used for distance in matching.", "Number"), "lng": ("Longitude.", "Number"),
 "permitted_uses": ("Uses the building allows, separated by semicolons.", "Text list"),
 "carpet_sqft": ("Usable floor area inside the walls, in sq ft.", "Number"),
 "super_builtup_sqft": ("Carpet area plus share of common areas (lobby, corridors, lifts).", "Number"),
 "chargeable_sqft": ("Area the rent is billed on. Usually equals super built-up.", "Number"),
 "loading_pct": ("Loading = (super built-up minus carpet) divided by carpet, as a percentage, rounded. Shows how much of the billed area is common area.", "Percent"),
 "pricing_model": ("Per sq ft, or Per seat for coworking.", "List"),
 "rent_per_sqft": ("Monthly rent per chargeable sq ft, in rupees, before GST.", "Rupees"),
 "monthly_rent": ("rent_per_sqft x chargeable_sqft, rounded to the nearest 5.", "Rupees"),
 "seats": ("Coworking only: seats in the space.", "Number"), "price_per_seat": ("Coworking only: monthly price per seat.", "Rupees"),
 "cam_per_sqft": ("Common area maintenance per sq ft per month.", "Rupees"),
 "all_in_per_sqft": ("rent_per_sqft + cam_per_sqft. This is the number occupiers compare and the match uses.", "Rupees"),
 "all_in_monthly": ("all_in_per_sqft x chargeable_sqft, before GST.", "Rupees"),
 "gst_pct": ("GST charged on commercial rent (18%).", "Percent"),
 "deposit_months": ("Security deposit in months of rent.", "Number"), "deposit_amount": ("monthly_rent x deposit_months.", "Rupees"),
 "lock_in_months": ("Months the occupier cannot exit.", "Number"), "lease_term_years": ("Usual lease length offered.", "Number"),
 "escalation_pct": ("Rent increase applied each escalation.", "Percent"), "escalation_every_years": ("Years between escalations.", "Number"),
 "rent_free_days": ("Rent-free days allowed for fit-out.", "Number"), "negotiable": ("Owner's stated room on rent: Yes, Slightly, No.", "List"),
 "brokerage_months": ("Brokerage the desk earns, in months of rent.", "Number"),
 "furnishing": ("Bare shell, Warm shell, Semi-furnished or Plug-and-play.", "List"),
 "workstations": ("Workstations installed.", "Number"), "cabins": ("Closed cabins installed.", "Number"), "meeting_rooms": ("Meeting rooms installed.", "Number"),
 "washrooms": ("Private or Common.", "List"), "ac_type": ("Central, Split (provision) or None.", "List"),
 "power_backup": ("100%, Partial or None.", "List"), "power_load_kw": ("Sanctioned electrical load in kW.", "Number"),
 "parking_4w": ("Reserved car parks included.", "Number"), "parking_2w": ("Reserved two-wheeler parks included.", "Number"),
 "frontage_ft": ("Shops and showrooms: road frontage in feet. Blank if not applicable.", "Number"),
 "clear_height_ft": ("Warehouses and sheds: clear height in feet.", "Number"), "road_width_ft": ("Width of the road the building faces.", "Number"),
 "fire_noc": ("Fire safety certificate on file: Yes or No.", "List"), "occupancy_certificate": ("Occupancy certificate on file: Yes or No.", "List"),
 "building_age_years": ("Age of the building in years.", "Number"), "amenities": ("Amenities, separated by semicolons.", "Text list"),
 "highlights": ("Up to four selling points shown on the card.", "Text list"), "description": ("Listing description.", "Text"),
 "status": ("Available, Under negotiation, LOI signed or Leased. Only Available units go to occupiers.", "List"),
 "available_from": ("Date the unit can be handed over (YYYY-MM-DD).", "Date"), "listed_date": ("Date the unit was listed.", "Date"),
 "last_confirmed": ("Last date the owner confirmed availability and terms. Units not confirmed for 14 days drop out of matching.", "Date"),
 "confirmed_via": ("WhatsApp reply, Call or Site visit.", "List"),
 "owner_name": ("Owner or landlord.", "Text"), "owner_type": ("Individual, Company, Developer or Trust.", "List"),
 "owner_phone": ("Owner phone (masked in the demo).", "Text"), "mandate": ("Exclusive or Open mandate.", "List"),
 "listing_agent": ("Team member who owns the listing.", "Text"), "photos": ("Number of photos on file.", "Number"),
 "floor_plan": ("Floor plan on file.", "List"), "video_tour": ("Video walkthrough on file.", "List"),
 "nearby": ("Nearest landmarks with straight-line distance.", "Text list"),
 "data_flag": ("Warning shown to the team. A flagged unit is never sent automatically.", "Text"),
}
assert set(DICT) == set(cols), set(cols) ^ set(DICT)

wb = Workbook(); ws = wb.active; ws.title = "Inventory"
ws.append(cols)
for r in rows: ws.append([r[c] for c in cols])
hdr = Font(bold=True, color="FFFFFF"); fill = PatternFill("solid", fgColor="0063D8")
for c in ws[1]: c.font = hdr; c.fill = fill; c.alignment = Alignment(vertical="center")
for i, c in enumerate(cols, 1):
    w = max(len(c), *(len(str(r[c] or "")) for r in rows[:20]))
    ws.column_dimensions[get_column_letter(i)].width = min(max(10, w + 2), 48)
ws.freeze_panes = "C2"
t = Table(displayName="Inventory", ref=f"A1:{get_column_letter(len(cols))}{len(rows)+1}")
t.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True); ws.add_table(t)
money = {"rent_per_sqft","monthly_rent","price_per_seat","cam_per_sqft","all_in_per_sqft","all_in_monthly","deposit_amount"}
for i, c in enumerate(cols, 1):
    if c in money:
        for row in ws.iter_rows(min_row=2, min_col=i, max_col=i):
            for cell in row: cell.number_format = '"₹"#,##0'
    if c in {"carpet_sqft","super_builtup_sqft","chargeable_sqft"}:
        for row in ws.iter_rows(min_row=2, min_col=i, max_col=i):
            for cell in row: cell.number_format = '#,##0'

d = wb.create_sheet("Data dictionary")
d.append(["Column", "What it means", "Type"])
for c in cols: d.append([c, DICT[c][0], DICT[c][1]])
for c in d[1]: c.font = hdr; c.fill = fill
d.column_dimensions["A"].width = 24; d.column_dimensions["B"].width = 100; d.column_dimensions["C"].width = 12
for row in d.iter_rows(min_row=2):
    row[1].alignment = Alignment(wrap_text=True, vertical="top")

h = wb.create_sheet("How to update")
for line in [
 ["How to keep the demo inventory current"],
 [""],
 ["1. Edit rows in the Inventory tab. Keep the header row and the unit_id column exactly as they are."],
 ["2. To add a unit, add a new row with a new unit_id (for example LC-051)."],
 ["3. To take a unit off the market, set status to Leased. Do not delete the row; the history stays."],
 ["4. In the demo, open Inventory > Sync from Google Sheet. Either press Sync now (live link), or copy the whole sheet (Ctrl+A, Ctrl+C) and paste it in."],
 ["5. The demo shows what was added, changed and removed before anything is applied."],
 ["6. Update last_confirmed every time an owner confirms. Units not confirmed for 14 days drop out of matching."],
]: h.append(line)
h["A1"].font = Font(bold=True, size=13); h.column_dimensions["A"].width = 120
json.dump({c: DICT[c][0] for c in cols}, open("dictionary.json", "w"), indent=1)
wb.save("Leasify_Commercial_Inventory.xlsx"); print("ok")
