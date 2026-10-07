// Industry → sub-industry → service, with the words Indian tender titles use for each service.
// Selecting services sets the tender keywords; nothing here costs anything to run.
const S = (id, label, kw) => ({ id, label, kw });

export const TAXONOMY = [
  { id: "con", label: "Construction & infrastructure", pack: "construction", subs: [
    { id: "con.roads", label: "Roads & highways", services: [
      S("con.roads.new", "New roads", ["construction of road", "road construction", "PMGSY", "link road", "approach road", "CC road", "interlocking"]),
      S("con.roads.upgrade", "Widening, strengthening, resurfacing", ["widening", "strengthening", "resurfacing", "bituminous", "pavement", "BC", "DBM", "patch work", "pothole"]),
      S("con.roads.maint", "Road maintenance", ["maintenance of road", "road maintenance", "OPRC", "routine maintenance"]),
    ] },
    { id: "con.bldg", label: "Buildings", services: [
      S("con.bldg.new", "New buildings", ["construction of building", "building construction", "school building", "hospital building", "residential quarters", "office building", "hostel", "community centre"]),
      S("con.bldg.repair", "Repair & renovation", ["repair", "renovation", "special repair", "upgradation of building", "retrofitting", "whitewash", "painting"]),
      S("con.bldg.interior", "Interiors & furnishing", ["interior", "false ceiling", "furnishing", "modular furniture", "partition"]),
    ] },
    { id: "con.water", label: "Water, sewerage & drainage", services: [
      S("con.water.supply", "Water supply", ["water supply", "pipeline", "tube well", "overhead tank", "OHT", "WTP", "water treatment", "rising main"]),
      S("con.water.sewer", "Sewerage & STP", ["sewer", "sewerage", "STP", "sewage treatment", "manhole"]),
      S("con.water.drain", "Drains & storm water", ["drain", "storm water", "nallah", "culvert", "drainage"]),
    ] },
    { id: "con.bridge", label: "Bridges & structures", services: [
      S("con.bridge.bridges", "Bridges, flyovers, ROB/RUB", ["bridge", "flyover", "ROB", "RUB", "underpass", "elevated"]),
      S("con.bridge.walls", "Retaining & boundary walls", ["retaining wall", "boundary wall", "RE wall", "protection wall"]),
    ] },
    { id: "con.urban", label: "Urban works", services: [
      S("con.urban.footpath", "Footpaths & cycle tracks", ["footpath", "cycle track", "pedestrian", "kerb"]),
      S("con.urban.parks", "Parks, landscaping, beautification", ["park", "landscaping", "beautification", "horticulture", "garden"]),
      S("con.urban.parking", "Parking & street furniture", ["parking", "street furniture", "bus shelter", "signage"]),
    ] },
    { id: "con.elec", label: "Electrical works", services: [
      S("con.elec.internal", "Internal electrification", ["electrification", "internal electrical", "wiring", "electrical works"]),
      S("con.elec.street", "Street lighting & HT/LT", ["street light", "high mast", "HT line", "LT line", "substation", "cabling", "transformer"]),
    ] },
    { id: "con.irr", label: "Irrigation & rail", services: [
      S("con.irr.canal", "Canals, dams, embankments", ["canal", "irrigation", "dam", "embankment", "distributary", "minor"]),
      S("con.irr.rail", "Railway civil works", ["railway", "level crossing", "platform", "track", "ballast"]),
    ] },
  ] },
  { id: "pro", label: "Professional services (CA, audit, consulting)", pack: "ca_audit", subs: [
    { id: "pro.audit", label: "Audit", services: [
      S("pro.audit.statutory", "Statutory audit", ["statutory audit", "statutory auditor", "branch audit"]),
      S("pro.audit.concurrent", "Concurrent & internal audit", ["concurrent audit", "internal audit", "revenue audit", "stock audit", "inspection audit"]),
      S("pro.audit.special", "Special audits (GST, forensic, IS)", ["GST audit", "forensic audit", "IS audit", "information systems audit", "special audit", "transaction audit"]),
    ] },
    { id: "pro.tax", label: "Accounting & tax", services: [
      S("pro.tax.accounts", "Accounting & bookkeeping", ["accounting", "bookkeeping", "accounts", "finalisation of accounts", "annual accounts"]),
      S("pro.tax.gst", "GST & income tax", ["GST consultancy", "GST return", "tax consultancy", "income tax", "TDS", "tax advisory"]),
      S("pro.tax.payroll", "Payroll & compliance", ["payroll", "compliance", "EPF", "ROC", "secretarial"]),
    ] },
    { id: "pro.consult", label: "Consulting", services: [
      S("pro.consult.dpr", "DPR & feasibility", ["DPR", "detailed project report", "feasibility", "survey and investigation"]),
      S("pro.consult.pmc", "PMC & third-party inspection", ["PMC", "project management consultancy", "TPI", "third party inspection", "quality monitoring"]),
      S("pro.consult.valuation", "Valuation", ["valuation", "valuer", "asset valuation"]),
      S("pro.consult.mgmt", "Management & HR consulting", ["consultancy services", "management consultancy", "HR consultancy", "transaction advisor"]),
    ] },
    { id: "pro.legal", label: "Legal", services: [S("pro.legal.all", "Legal services", ["legal", "advocate", "law firm", "panel lawyer"])] },
  ] },
  { id: "it", label: "IT & telecom", pack: "it_services", subs: [
    { id: "it.soft", label: "Software", services: [
      S("it.soft.dev", "Software & app development", ["software development", "application development", "mobile app", "ERP", "e-governance"]),
      S("it.soft.web", "Websites & portals", ["website", "web portal", "portal development"]),
      S("it.soft.data", "Data entry & digitisation", ["data entry", "digitisation", "digitization", "scanning", "document management"]),
    ] },
    { id: "it.hw", label: "Hardware & networks", services: [
      S("it.hw.supply", "Computers & peripherals", ["computer", "laptop", "desktop", "printer", "server", "UPS", "tablet"]),
      S("it.hw.network", "Networking & CCTV", ["networking", "LAN", "Wi-Fi", "CCTV", "surveillance", "camera", "fibre", "OFC"]),
      S("it.hw.amc", "IT maintenance (AMC)", ["AMC", "annual maintenance", "comprehensive maintenance", "IT support", "facility management services"]),
    ] },
    { id: "it.cloud", label: "Cloud & security", services: [S("it.cloud.all", "Cloud, hosting, cyber security", ["cloud", "hosting", "data centre", "cyber security", "VAPT", "firewall"])] },
  ] },
  { id: "fac", label: "Facility management & manpower", pack: "it_services", subs: [
    { id: "fac.man", label: "Manpower", services: [
      S("fac.man.outsourcing", "Manpower outsourcing", ["manpower", "outsourcing", "deployment of staff", "data entry operator", "MTS", "skilled", "unskilled"]),
      S("fac.man.security", "Security services", ["security guard", "security services", "watch and ward", "ex-servicemen"]),
    ] },
    { id: "fac.soft", label: "Soft services", services: [
      S("fac.soft.housekeeping", "Housekeeping & cleaning", ["housekeeping", "cleaning", "sanitation", "mechanised cleaning", "sweeping"]),
      S("fac.soft.catering", "Catering & mess", ["catering", "mess", "canteen", "food supply"]),
      S("fac.soft.pest", "Pest control & gardening", ["pest control", "fumigation", "gardening", "mali"]),
    ] },
    { id: "fac.trans", label: "Vehicles & events", services: [
      S("fac.trans.vehicles", "Vehicle hiring", ["hiring of vehicle", "vehicle on hire", "taxi", "bus on hire", "car rental"]),
      S("fac.trans.events", "Event management", ["event management", "exhibition", "conference", "tent", "decoration"]),
    ] },
  ] },
  { id: "sup", label: "Supply of goods", pack: "goods_supply", subs: [
    { id: "sup.office", label: "Office & institutional", services: [
      S("sup.office.stationery", "Stationery & office supplies", ["stationery", "office supplies", "paper", "toner", "cartridge"]),
      S("sup.office.furniture", "Furniture", ["furniture", "chairs", "tables", "almirah", "steel furniture"]),
      S("sup.office.uniform", "Uniforms & textiles", ["uniform", "textile", "blanket", "bedsheet", "linen"]),
    ] },
    { id: "sup.build", label: "Construction materials", services: [
      S("sup.build.materials", "Cement, steel, bitumen, aggregates", ["cement", "steel", "TMT", "bitumen", "emulsion", "aggregate", "sand", "bricks", "pipes"]),
    ] },
    { id: "sup.health", label: "Medical", services: [
      S("sup.health.equipment", "Medical equipment", ["medical equipment", "hospital equipment", "X-ray", "ventilator", "diagnostic equipment"]),
      S("sup.health.drugs", "Medicines & consumables", ["medicines", "drugs", "surgical", "consumables", "PPE"]),
    ] },
    { id: "sup.elec", label: "Electrical & electronics", services: [
      S("sup.elec.goods", "Electrical goods & lighting", ["LED", "luminaire", "cable", "wire", "switchgear", "fan", "air conditioner"]),
      S("sup.elec.lab", "Lab & scientific equipment", ["laboratory equipment", "lab equipment", "scientific equipment", "chemicals"]),
    ] },
    { id: "sup.other", label: "Vehicles, food & other", services: [
      S("sup.other.vehicles", "Vehicles & spares", ["vehicle", "spare parts", "tyres", "battery"]),
      S("sup.other.food", "Food grains & provisions", ["food grains", "ration", "provisions", "rice", "wheat", "pulses"]),
    ] },
  ] },
  { id: "ene", label: "Energy & environment", pack: null, subs: [
    { id: "ene.solar", label: "Solar & power", services: [
      S("ene.solar.plants", "Solar plants & rooftop", ["solar", "rooftop", "solar power plant", "solar pump", "PV"]),
      S("ene.solar.dg", "DG sets & power backup", ["DG set", "generator", "power backup", "inverter"]),
    ] },
    { id: "ene.waste", label: "Waste & environment", services: [
      S("ene.waste.swm", "Solid waste management", ["solid waste", "garbage", "waste management", "door to door collection", "landfill", "legacy waste"]),
      S("ene.waste.env", "Environment & pollution control", ["pollution", "air quality", "environmental", "EIA", "plantation"]),
    ] },
  ] },
  { id: "med", label: "Printing, media & publicity", pack: null, subs: [
    { id: "med.print", label: "Printing & media", services: [
      S("med.print.printing", "Printing", ["printing", "booklet", "brochure", "forms printing"]),
      S("med.print.ads", "Advertising & publicity", ["advertisement", "publicity", "hoarding", "branding", "media campaign", "IEC"]),
      S("med.print.video", "Video & photography", ["videography", "photography", "documentary", "film"]),
    ] },
  ] },
  { id: "edu", label: "Education, training & health services", pack: null, subs: [
    { id: "edu.train", label: "Training", services: [
      S("edu.train.skill", "Skill development & training", ["training", "skill development", "capacity building", "workshop", "coaching"]),
    ] },
    { id: "edu.health", label: "Health services", services: [
      S("edu.health.services", "Hospital & diagnostic services", ["diagnostic services", "pathology", "radiology", "ambulance", "hospital services", "dialysis"]),
    ] },
  ] },
  { id: "log", label: "Transport & logistics", pack: null, subs: [
    { id: "log.trans", label: "Logistics", services: [
      S("log.trans.freight", "Transportation & handling", ["transportation", "loading and unloading", "handling", "carriage", "freight", "warehousing"]),
    ] },
  ] },
  { id: "agr", label: "Agriculture & rural", pack: null, subs: [
    { id: "agr.inputs", label: "Agriculture", services: [
      S("agr.inputs.seeds", "Seeds, fertiliser, agro inputs", ["seeds", "fertiliser", "fertilizer", "pesticide", "agriculture", "farm machinery"]),
      S("agr.inputs.rural", "Rural development works", ["MGNREGA", "rural development", "pond", "check dam", "watershed"]),
    ] },
  ] },
];

export const SERVICE_INDEX = Object.fromEntries(TAXONOMY.flatMap((i) => i.subs.flatMap((s) => s.services.map((v) => [v.id, { ...v, sub: s.label, industry: i.label, industryId: i.id, pack: i.pack }]))));

export function keywordsFor(serviceIds) {
  return [...new Set(serviceIds.flatMap((id) => SERVICE_INDEX[id]?.kw || []))];
}
export function labelsFor(serviceIds) {
  return serviceIds.map((id) => SERVICE_INDEX[id]?.label).filter(Boolean);
}
