"""Generate the Leasify Commercial dummy inventory: 50 commercial units in and around
Bhubaneswar, Cuttack and Puri. Deterministic (seeded). Outputs JSON, CSV and XLSX."""
import json, csv, random, math, datetime as dt
from pathlib import Path

random.seed(20261010)
OUT = Path(__file__).parent
TODAY = dt.date(2026, 10, 10)

# locality -> (city, lat, lng, micro_market note, road)
LOC = {
    "Patia":               ("Bhubaneswar", 20.3540, 85.8215, "IT and education belt near KIIT", "Patia Main Road"),
    "Chandrasekharpur":    ("Bhubaneswar", 20.3245, 85.8170, "Established office and residential hub", "NH-16 Service Road"),
    "Infocity":            ("Bhubaneswar", 20.3445, 85.8065, "IT/ITeS cluster, Chandaka Industrial Estate", "Infocity Road"),
    "Jaydev Vihar":        ("Bhubaneswar", 20.2985, 85.8195, "Central business and hotel district", "Nandankanan Road"),
    "Saheed Nagar":        ("Bhubaneswar", 20.2880, 85.8445, "High-footfall retail and offices", "Saheed Nagar Main Road"),
    "Janpath":             ("Bhubaneswar", 20.2700, 85.8395, "Prime high street", "Janpath"),
    "Nayapalli":           ("Bhubaneswar", 20.2925, 85.8085, "Mixed commercial, near NH-16", "Nayapalli Main Road"),
    "Rasulgarh":           ("Bhubaneswar", 20.2960, 85.8640, "Retail and auto showrooms on NH-16", "NH-16 Rasulgarh"),
    "Khandagiri":          ("Bhubaneswar", 20.2565, 85.7790, "Education and retail, western BBSR", "Khandagiri Square"),
    "Mancheswar":          ("Bhubaneswar", 20.3115, 85.8580, "Industrial estate, light manufacturing", "Mancheswar Industrial Estate Road"),
    "Bomikhal":            ("Bhubaneswar", 20.2845, 85.8560, "Retail and clinics near Cuttack Road", "Cuttack Road"),
    "Cuttack-Puri Bypass": ("Bhubaneswar", 20.2520, 85.8505, "Highway-facing showrooms and warehouses", "Cuttack-Puri Bypass Road"),
    "Buxi Bazaar":         ("Cuttack", 20.4685, 85.8790, "Old city trading market", "Buxi Bazaar Road"),
    "Badambadi":           ("Cuttack", 20.4560, 85.8890, "Bus terminus area, retail and offices", "Badambadi Main Road"),
    "Link Road":           ("Cuttack", 20.4505, 85.8870, "Modern retail and offices", "Link Road"),
    "Cantonment Road":     ("Cuttack", 20.4720, 85.8885, "Banks, offices and clinics", "Cantonment Road"),
    "Jagatpur":            ("Cuttack", 20.4440, 85.9180, "Industrial estate and warehousing", "Jagatpur Industrial Estate Road"),
    "CDA Markat Nagar":    ("Cuttack", 20.4870, 85.8380, "Planned township, new retail", "CDA Sector 9 Main Road"),
    "Grand Road":          ("Puri", 19.8065, 85.8235, "Pilgrim high street, very high footfall", "Bada Danda (Grand Road)"),
    "VIP Road":            ("Puri", 19.7980, 85.8320, "Hotels, restaurants and tourist retail", "VIP Road"),
    "Chakratirtha Road":   ("Puri", 19.7920, 85.8400, "Beachfront hotels and food outlets", "CT Road"),
    "Station Road":        ("Puri", 19.8175, 85.8325, "Railway station area, offices and retail", "Station Road"),
    "Trisulia":            ("Cuttack (Trisulia)", 20.4250, 85.8330, "NH-16 logistics and showroom corridor", "NH-16 Trisulia"),
    "Phulnakhara":         ("Cuttack (Phulnakhara)", 20.4040, 85.8780, "Warehousing on NH-16, between BBSR and Cuttack", "NH-16 Phulnakhara"),
    "Jatni":               ("Jatni", 20.1700, 85.7070, "Railway town near IIT Bhubaneswar", "Jatni Main Road"),
}

# Hand-specified listings: (locality, type, building, unit_no, floor, total_floors, chargeable_sqft, rent_psf, furnishing, grade)
SPEC = [
    # Bhubaneswar: 20
    ("Patia", "Office", "Sunrise Tech Park", "4B", 4, 9, 2400, 58, "Warm shell", "A"),
    ("Patia", "Office", "Sunrise Tech Park", "7A", 7, 9, 5200, 62, "Plug-and-play", "A"),
    ("Patia", "Coworking", "Workbay Patia", "Cabin 12 (10 seats)", 2, 4, 900, 85, "Plug-and-play", "B"),
    ("Infocity", "Office", "Silverline Corporate Tower", "3rd floor (full)", 3, 8, 12500, 65, "Bare shell", "A"),
    ("Infocity", "Office", "Silverline Corporate Tower", "6C", 6, 8, 3100, 68, "Plug-and-play", "A"),
    ("Chandrasekharpur", "Office", "Crescent Business Centre", "201", 2, 6, 1800, 48, "Semi-furnished", "B"),
    ("Chandrasekharpur", "Clinic", "Crescent Business Centre", "G-04", 0, 6, 1250, 75, "Warm shell", "B"),
    ("Jaydev Vihar", "Office", "Harbour Point", "502", 5, 10, 2900, 60, "Plug-and-play", "A"),
    ("Jaydev Vihar", "F&B space", "Harbour Point", "G-01", 0, 10, 2200, 140, "Warm shell", "A"),
    ("Saheed Nagar", "Retail shop", "Meridian Arcade", "G-12", 0, 4, 650, 155, "Bare shell", "B"),
    ("Saheed Nagar", "Office", "Meridian Arcade", "305", 3, 4, 1400, 45, "Semi-furnished", "B"),
    ("Janpath", "Showroom", "Janpath Galleria", "G+1 Unit 3", 0, 3, 3400, 190, "Bare shell", "A"),
    ("Janpath", "Retail shop", "Janpath Galleria", "G-07", 0, 3, 480, 210, "Warm shell", "A"),
    ("Nayapalli", "Institutional", "Northgate Commercial", "First floor", 1, 3, 4200, 38, "Bare shell", "B"),
    ("Nayapalli", "Retail shop", "Northgate Commercial", "G-02", 0, 3, 900, 110, "Bare shell", "B"),
    ("Rasulgarh", "Showroom", "Riverside Square", "G-01 (corner)", 0, 5, 5800, 95, "Bare shell", "A"),
    ("Khandagiri", "Retail shop", "Hillview Plaza", "G-05", 0, 4, 720, 95, "Bare shell", "B"),
    ("Mancheswar", "Warehouse", "Mancheswar Logistics Park", "Shed 4", 0, 1, 15000, 24, "Bare shell", "B"),
    ("Bomikhal", "Clinic", "Bomikhal Trade Centre", "101", 1, 4, 1600, 55, "Warm shell", "B"),
    ("Cuttack-Puri Bypass", "Showroom", "Bypass Trade Centre", "G-02", 0, 3, 4500, 80, "Bare shell", "B"),
    # Cuttack-Puri bypass corridor extras: 3
    ("Cuttack-Puri Bypass", "Warehouse", "Uttara Highway Godown", "Godown B", 0, 1, 20000, 19, "Bare shell", "C"),
    ("Cuttack-Puri Bypass", "F&B space", "Bypass Trade Centre", "First floor", 1, 3, 3000, 70, "Warm shell", "B"),
    ("Cuttack-Puri Bypass", "Industrial shed", "Pipili Road Industrial Yard", "Shed 2", 0, 1, 12000, 17, "Bare shell", "C"),
    # Cuttack: 9
    ("Buxi Bazaar", "Retail shop", "Buxi Bazaar Market Complex", "G-18", 0, 3, 420, 135, "Bare shell", "C"),
    ("Buxi Bazaar", "Retail shop", "Buxi Bazaar Market Complex", "G-21", 0, 3, 560, 125, "Bare shell", "C"),
    ("Badambadi", "Office", "Badambadi Business Hub", "401", 4, 6, 2100, 42, "Semi-furnished", "B"),
    ("Badambadi", "Showroom", "Badambadi Business Hub", "G-01", 0, 6, 2800, 105, "Bare shell", "B"),
    ("Link Road", "Office", "Link Road Corporate House", "6th floor (full)", 6, 7, 6500, 46, "Warm shell", "A"),
    ("Link Road", "Retail shop", "Link Road Corporate House", "G-03", 0, 7, 1100, 120, "Warm shell", "A"),
    ("Cantonment Road", "Clinic", "Cantonment Square", "102", 1, 4, 1900, 60, "Warm shell", "B"),
    ("Jagatpur", "Warehouse", "Jagatpur Warehousing Yard", "Bay 7", 0, 1, 18000, 21, "Bare shell", "B"),
    ("CDA Markat Nagar", "Retail shop", "CDA Sector 9 Commercial Plaza", "G-09", 0, 4, 850, 80, "Bare shell", "B"),
    # Puri: 6
    ("Grand Road", "Retail shop", "Grand Road Arcade", "G-04", 0, 3, 380, 175, "Bare shell", "B"),
    ("Grand Road", "Showroom", "Grand Road Arcade", "G+1 Unit 1", 0, 3, 1800, 130, "Warm shell", "B"),
    ("VIP Road", "F&B space", "Seaview Commercial", "G-02", 0, 4, 2600, 95, "Warm shell", "B"),
    ("Chakratirtha Road", "F&B space", "CT Road Food Court Block", "Unit 5", 0, 2, 1400, 110, "Plug-and-play", "B"),
    ("Station Road", "Office", "Station Road Plaza", "203", 2, 4, 1500, 35, "Semi-furnished", "C"),
    ("VIP Road", "Retail shop", "Seaview Commercial", "G-06", 0, 4, 600, 120, "Bare shell", "B"),
    # Trisulia: 4
    ("Trisulia", "Warehouse", "NH-16 Trisulia Logistics Hub", "Block A", 0, 1, 25000, 20, "Bare shell", "B"),
    ("Trisulia", "Showroom", "Trisulia Auto Showroom Block", "Unit 2", 0, 2, 6000, 55, "Bare shell", "B"),
    ("Trisulia", "Warehouse", "NH-16 Trisulia Logistics Hub", "Block C", 0, 1, 10000, 22, "Bare shell", "B"),
    ("Trisulia", "Office", "Trisulia Auto Showroom Block", "First floor", 1, 2, 2000, 32, "Semi-furnished", "C"),
    # Phulnakhara: 3
    ("Phulnakhara", "Warehouse", "Phulnakhara Warehousing Park", "WH-3", 0, 1, 30000, 18, "Bare shell", "B"),
    ("Phulnakhara", "Industrial shed", "Phulnakhara Warehousing Park", "Shed 9", 0, 1, 8000, 20, "Bare shell", "C"),
    ("Phulnakhara", "Showroom", "Phulnakhara Highway Arcade", "G-01", 0, 2, 3200, 48, "Bare shell", "C"),
    # Jatni: 5
    ("Jatni", "Retail shop", "Jatni Market Complex", "G-11", 0, 3, 500, 60, "Bare shell", "C"),
    ("Jatni", "Office", "Khurda Road Business Centre", "204", 2, 4, 1600, 30, "Semi-furnished", "C"),
    ("Jatni", "Warehouse", "Jatni Logistics Shed", "Shed 1", 0, 1, 14000, 16, "Bare shell", "C"),
    ("Jatni", "Coworking", "Khurda Road Business Centre", "Hall (24 seats)", 3, 4, 1800, 42, "Plug-and-play", "C"),
    ("Jatni", "Institutional", "Jatni Market Complex", "Second floor", 2, 3, 2600, 28, "Bare shell", "C"),
]
assert len(SPEC) == 50, len(SPEC)

OWNERS = [
    ("Sanjay Kumar Mishra", "Individual"), ("Lipika Rath", "Individual"), ("Pradhan Infra Pvt Ltd", "Company"),
    ("Dr. Ashok Behera", "Individual"), ("Kalinga Estates LLP", "Company"), ("Mohanty Family Trust", "Trust"),
    ("Bikash Sahu", "Individual"), ("Sasmita Panda", "Individual"), ("Utkal Realcon Pvt Ltd", "Developer"),
    ("Ramesh Agarwal", "Individual"), ("Debasis Nayak", "Individual"), ("Kabita Das", "Individual"),
    ("Swain Developers", "Developer"), ("Manoj Patnaik", "Individual"), ("Acharya Holdings", "Company"),
    ("Rout Warehousing Pvt Ltd", "Company"),
]
# building -> owner pool (strata buildings have several owners)
BUILDING_OWNER = {}
AGENTS = {"Bhubaneswar": ["Rohit Mohanty", "Priyanka Das", "Subham Sahoo"], "Cuttack": ["Ananya Patnaik"],
          "Puri": ["Satya Prakash Jena"], "Jatni": ["Subham Sahoo"]}

USES = {
    "Office": ["Office", "IT/ITeS", "Back office", "Training centre"],
    "Coworking": ["Office", "IT/ITeS", "Startup", "Training centre"],
    "Clinic": ["Clinic", "Diagnostics", "Office"],
    "F&B space": ["Restaurant", "Cafe", "Cloud kitchen", "Retail"],
    "Retail shop": ["Retail", "Pharmacy", "Mobile/electronics", "Cafe", "Bank ATM"],
    "Showroom": ["Showroom", "Retail", "Auto showroom", "Furniture/electronics"],
    "Institutional": ["Coaching centre", "School/education", "Training centre", "Office"],
    "Warehouse": ["Warehouse", "Distribution", "E-commerce fulfilment", "Cold chain (needs fit-out)"],
    "Industrial shed": ["Light manufacturing", "Warehouse", "Workshop"],
}
AMENITY_POOL = ["Lift", "24x7 security", "CCTV", "Fire NOC", "Occupancy certificate", "Visitor parking", "Signage rights",
                "Private washroom", "Pantry", "Central AC", "Generator backup", "Main road facing", "Corner unit",
                "Loading dock", "Truck access (32 ft)", "24x7 access", "Rainwater harvesting", "Wheelchair access"]

LANDMARKS = [
    ("Biju Patnaik Airport", 20.2444, 85.8178), ("Bhubaneswar Railway Station", 20.2672, 85.8436),
    ("Infocity Square", 20.3445, 85.8065), ("KIIT Square", 20.3540, 85.8180), ("AIIMS Bhubaneswar", 20.2316, 85.7743),
    ("Cuttack Railway Station", 20.4655, 85.8790), ("SCB Medical College", 20.4710, 85.8890),
    ("Puri Railway Station", 19.8175, 85.8325), ("Jagannath Temple, Puri", 19.8048, 85.8180),
    ("IIT Bhubaneswar", 20.1480, 85.6710), ("Khurda Road Junction", 20.1690, 85.6230),
    ("Badambadi Bus Stand", 20.4560, 85.8890), ("Barabati Stadium", 20.4835, 85.8665), ("Puri Sea Beach", 19.7960, 85.8290),
    ("Vani Vihar Square", 20.2960, 85.8410), ("Kalinga Stadium", 20.2875, 85.8215), ("Jatni Railway Station", 20.1650, 85.7070),
    ("Uttara Square", 20.2340, 85.8470),
]

def hav(a, b, c, d):
    R = 6371.0
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))

def r5(x): return int(round(x / 5.0) * 5)

rows = []
for i, (loc, ptype, bldg, unit_no, floor, tfloors, charge, rent, furn, grade) in enumerate(SPEC, start=1):
    city, lat, lng, mm, road = LOC[loc]
    lat += random.uniform(-0.004, 0.004); lng += random.uniform(-0.004, 0.004)
    # loading: offices 25-38%, retail 15-25%, warehouse ~0-8%
    if ptype in ("Warehouse", "Industrial shed"):
        loading = random.choice([0, 0, 5, 8])
    elif ptype in ("Retail shop", "Showroom", "F&B space"):
        loading = random.randint(15, 25)
    else:
        loading = random.randint(24, 38)
    sba = charge
    carpet = round(sba / (1 + loading / 100.0) * random.uniform(0.95, 1.0)) if loading else round(sba * 0.97)
    loading = round((sba - carpet) / carpet * 100)   # one formula everywhere: (super built-up - carpet) / carpet
    cam = {"Warehouse": random.choice([1, 2, 2, 3]), "Industrial shed": random.choice([1, 1.5, 2])}.get(ptype)
    if cam is None:
        cam = random.choice([4, 5, 6]) if ptype in ("Retail shop", "Showroom", "F&B space") else random.choice([6, 7, 8, 9, 10, 12])
        if grade == "C": cam = max(3, cam - 3)
    deposit = random.choice([3, 4, 6] if ptype in ("Warehouse", "Industrial shed") else [6, 6, 8, 10] if grade == "A" else [3, 4, 6, 6])
    lockin = random.choice([12, 24, 36] if grade == "A" else [11, 12, 24])
    term = random.choice([3, 5, 9] if grade == "A" or ptype in ("Warehouse", "Showroom") else [3, 3, 5])
    esc_pct, esc_every = random.choice([(5, 1), (5, 1), (15, 3), (10, 2)])
    rent_free = {"Bare shell": random.choice([45, 60, 90]), "Warm shell": random.choice([30, 45]), "Semi-furnished": random.choice([15, 30]), "Plug-and-play": 0}[furn]
    power_backup = random.choice(["100%", "100%", "Partial"]) if grade in ("A", "B") else random.choice(["Partial", "None"])
    if furn == "Plug-and-play": power_backup = "100%"
    load_kw = max(5, int(charge / 1000 * random.choice([8, 10, 12]))) if ptype not in ("Warehouse", "Industrial shed") else random.choice([25, 40, 63, 100])
    p4 = max(0, int(charge / 1000 * (random.choice([1, 1.5, 2]) if ptype == "Office" else 0.6))) if ptype not in ("Retail shop",) else random.choice([0, 1, 2])
    if loc in ("Buxi Bazaar", "Grand Road") : p4 = 0
    p2 = p4 * 3 + random.randint(2, 10)
    frontage = random.choice([12, 15, 18, 20, 25]) if ptype in ("Retail shop", "F&B space") and floor == 0 else (random.choice([40, 50, 60, 80]) if ptype == "Showroom" else None)
    clear_h = random.choice([24, 28, 32, 36]) if ptype in ("Warehouse", "Industrial shed") else None
    road_w = random.choice([40, 60, 80, 100]) if loc not in ("Buxi Bazaar", "Grand Road", "Station Road") else random.choice([30, 40])
    if loc in ("Trisulia", "Phulnakhara", "Cuttack-Puri Bypass") or "NH" in road: road_w = random.choice([100, 150])
    am = set()
    if tfloors > 2: am.add("Lift")
    am.update(random.sample(["24x7 security", "CCTV", "Fire NOC", "Occupancy certificate", "Visitor parking", "Signage rights"], k=random.randint(3, 6)))
    if ptype in ("Office", "Coworking", "Clinic", "Institutional"): am.update(random.sample(["Private washroom", "Pantry", "Central AC", "Wheelchair access"], k=random.randint(1, 3)))
    if ptype in ("Retail shop", "Showroom", "F&B space") and floor == 0: am.add("Main road facing") if random.random() < .7 else None
    if "corner" in unit_no.lower(): am.add("Corner unit")
    if ptype in ("Warehouse", "Industrial shed"): am.update(["Loading dock", "Truck access (32 ft)", "24x7 access"])
    if power_backup == "100%": am.add("Generator backup")
    if furn == "Plug-and-play": am.update(["Central AC", "Pantry"])
    fire_noc = "Fire NOC" in am
    oc = "Occupancy certificate" in am
    owner = random.choice(OWNERS)
    if bldg in BUILDING_OWNER and random.random() < .4:
        owner = BUILDING_OWNER[bldg]
    BUILDING_OWNER.setdefault(bldg, owner)
    mandate = random.choice(["Exclusive", "Open", "Open", "Exclusive"])
    brokerage = random.choice([1, 1, 1.5, 2]) if mandate == "Exclusive" else random.choice([1, 1])
    listed = TODAY - dt.timedelta(days=random.randint(6, 160))
    avail = TODAY + dt.timedelta(days=random.choice([-150, -110, -85, -60, -45, -30, -21, -12, 0, 15, 30, 45, 60, 90]))
    if avail < listed: avail = listed
    conf_days = random.choice([0, 1, 2, 3, 4, 5, 6, 2, 3, 1])
    status = "Available"
    rnd = random.random()
    if i in (8, 27, 44): conf_days = random.randint(15, 24)          # stale: drops out of matching
    if i in (5, 33): conf_days = random.randint(9, 13)                  # amber
    if i in (14, 39): status = "Under negotiation"
    if i in (22,): status = "LOI signed"
    if i in (47,): status = "Leased"
    last_conf = TODAY - dt.timedelta(days=conf_days)
    city_key = city.split(" (")[0]
    agent = random.choice(AGENTS.get(city_key, AGENTS["Bhubaneswar"]))
    workstations = int(charge / 65) if furn == "Plug-and-play" and ptype in ("Office", "Coworking") else (int(charge / 80) if furn == "Semi-furnished" else 0)
    cabins = (max(1, charge // 1500) if workstations else 0)
    meeting = (1 if charge < 3000 else 2) if workstations else 0
    seats = None; per_seat = None; pricing = "Per sq ft"
    if ptype == "Coworking":
        seats = int(unit_no.split("(")[1].split(" ")[0]) if "(" in unit_no else 10
        per_seat = int(round(rent * charge / seats, -2)); pricing = "Per seat"
    monthly_rent = r5(rent * charge)
    allin = rent + cam
    gst = 18
    nearby = sorted(((n, round(hav(lat, lng, a, b), 1)) for n, a, b in LANDMARKS if hav(lat, lng, a, b) < 12), key=lambda x: x[1])[:3]
    hl = []
    if "Main road facing" in am: hl.append(f"Faces {road} ({road_w} ft road)")
    if frontage: hl.append(f"{frontage} ft frontage")
    if furn == "Plug-and-play": hl.append("Move in within a week")
    if clear_h: hl.append(f"{clear_h} ft clear height")
    if power_backup == "100%": hl.append("100% power backup")
    if p4: hl.append(f"{p4} car parks")
    if grade == "A": hl.append("Grade A building")
    if i == 35:   # a food unit without a fire NOC on file: shows the "check before offering" rule in the demo
        am.discard("Fire NOC"); fire_noc = False
    flag = None
    if not fire_noc and ptype in ("F&B space", "Institutional", "Clinic"):
        flag = "Fire NOC not on file. Confirm before offering to food, clinic or education use."
    title = f"{charge:,} sq ft {ptype.lower() if ptype not in ('F&B space',) else 'F&B space'} in {bldg}, {loc}"
    desc_bits = {
        "Office": f"{furn} office on floor {floor} of {tfloors} in {bldg}. {mm}.",
        "Coworking": f"Managed {unit_no.split('(')[-1].rstrip(')')} space, ready to use. {mm}.",
        "Clinic": f"Ground-access space suited to a clinic or diagnostics centre. {mm}.",
        "F&B space": f"Space approved for food and beverage use. {mm}.",
        "Retail shop": f"Street-level shop with good visibility. {mm}.",
        "Showroom": f"Large-format showroom with double-height glazing. {mm}.",
        "Institutional": f"Open floor suited to coaching or training. {mm}.",
        "Warehouse": f"Grade {grade} warehouse with truck access. {mm}.",
        "Industrial shed": f"Industrial shed for light manufacturing or storage. {mm}.",
    }
    rows.append({
        "unit_id": f"LC-{i:03d}",
        "listing_title": title,
        "property_type": ptype,
        "grade": grade,
        "building_name": bldg,
        "unit_no": unit_no,
        "floor": floor,
        "total_floors": tfloors,
        "city": city,
        "locality": loc,
        "micro_market": mm,
        "address": f"{unit_no}, {bldg}, {road}, {loc}, {city_key}",
        "pincode": {"Bhubaneswar": "751024", "Cuttack": "753001", "Puri": "752001", "Jatni": "752050"}.get(city_key, "751001"),
        "lat": round(lat, 5), "lng": round(lng, 5),
        "permitted_uses": "; ".join(USES[ptype]),
        "carpet_sqft": carpet,
        "super_builtup_sqft": sba,
        "chargeable_sqft": charge,
        "loading_pct": loading,
        "pricing_model": pricing,
        "rent_per_sqft": rent,
        "monthly_rent": monthly_rent,
        "seats": seats,
        "price_per_seat": per_seat,
        "cam_per_sqft": cam,
        "all_in_per_sqft": allin,
        "all_in_monthly": r5(allin * charge),
        "gst_pct": gst,
        "deposit_months": deposit,
        "deposit_amount": monthly_rent * deposit,
        "lock_in_months": lockin,
        "lease_term_years": term,
        "escalation_pct": esc_pct,
        "escalation_every_years": esc_every,
        "rent_free_days": rent_free,
        "negotiable": random.choice(["Yes", "Yes", "Slightly", "No"]),
        "brokerage_months": brokerage,
        "furnishing": furn,
        "workstations": workstations,
        "cabins": cabins,
        "meeting_rooms": meeting,
        "washrooms": "Private" if "Private washroom" in am else "Common",
        "ac_type": "Central" if "Central AC" in am else ("Split (provision)" if furn != "Bare shell" else "None"),
        "power_backup": power_backup,
        "power_load_kw": load_kw,
        "parking_4w": p4,
        "parking_2w": p2,
        "frontage_ft": frontage,
        "clear_height_ft": clear_h,
        "road_width_ft": road_w,
        "fire_noc": "Yes" if fire_noc else "No",
        "occupancy_certificate": "Yes" if oc else "No",
        "building_age_years": random.randint(1, 18),
        "amenities": "; ".join(sorted(am)),
        "highlights": "; ".join(hl[:4]),
        "description": desc_bits[ptype],
        "status": status,
        "available_from": avail.isoformat(),
        "listed_date": listed.isoformat(),
        "last_confirmed": last_conf.isoformat(),
        "confirmed_via": random.choice(["WhatsApp reply", "WhatsApp reply", "Call", "Site visit"]),
        "owner_name": owner[0],
        "owner_type": owner[1],
        "owner_phone": f"+91 9{random.randint(100,999)}X XXX{random.randint(10,99)}",
        "mandate": mandate,
        "listing_agent": agent,
        "photos": random.randint(5, 14),
        "floor_plan": random.choice(["Yes", "Yes", "No"]),
        "video_tour": random.choice(["Yes", "No", "No"]),
        "nearby": "; ".join(f"{n} {d} km" for n, d in nearby),
        "data_flag": flag or "",
    })

(OUT / "inventory.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False), encoding="utf-8")
cols = list(rows[0].keys())
with open(OUT / "Leasify_Commercial_Inventory.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); [w.writerow(r) for r in rows]
print(len(rows), "units;", len(cols), "fields")
from collections import Counter
print(Counter(r["city"] for r in rows)); print(Counter(r["property_type"] for r in rows)); print(Counter(r["status"] for r in rows))
