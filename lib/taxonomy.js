// Industry → sub-industry → service, with the words Indian tender titles use for each service.
// Selecting services sets the tender keywords; nothing here costs anything to run.
const S = (id, label, kw) => ({ id, label, kw });

export const TAXONOMY = [
  { id: "con", label: "Construction & infrastructure", pack: "construction", subs: [
    { id: "con.roads", label: "Roads & highways", services: [
      S("con.roads.new", "New roads", ["construction of road", "road construction", "PMGSY", "link road", "approach road", "CC road", "interlocking"]),
      S("con.roads.upgrade", "Widening, strengthening, resurfacing", ["widening", "strengthening", "resurfacing", "bituminous", "pavement", "BC + road|bituminous", "DBM", "patch work", "pothole"]),
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
      S("con.bridge.bridges", "Bridges, flyovers, ROB/RUB", ["bridge", "flyover", "ROB", "RUB", "underpass", "elevated + road|corridor|flyover"]),
      S("con.bridge.walls", "Retaining & boundary walls", ["retaining wall", "boundary wall", "RE wall", "protection wall"]),
    ] },
    { id: "con.urban", label: "Urban works", services: [
      S("con.urban.footpath", "Footpaths & cycle tracks", ["footpath", "cycle track", "pedestrian", "kerb"]),
      S("con.urban.parks", "Parks, landscaping, beautification", ["park + development|landscap|garden|children|construction|beautification", "landscaping", "beautification", "horticulture", "garden"]),
      S("con.urban.parking", "Parking & street furniture", ["parking", "street furniture", "bus shelter", "signage"]),
    ] },
    { id: "con.elec", label: "Electrical works", services: [
      S("con.elec.internal", "Internal electrification", ["electrification", "internal electrical", "wiring", "electrical works"]),
      S("con.elec.street", "Street lighting & HT/LT", ["street light", "high mast", "HT line", "LT line", "substation", "cabling", "transformer"]),
    ] },
    { id: "con.irr", label: "Irrigation & rail", services: [
      S("con.irr.canal", "Canals, dams, embankments", ["canal", "irrigation", "dam", "embankment", "distributary", "minor + canal|irrigation|distributary"]),
      S("con.irr.rail", "Railway civil works", ["railway", "level crossing", "platform + railway|station", "track + railway|rail|siding", "ballast"]),
    ] },
  ] },
  { id: "pro", label: "Professional services (CA, audit, consulting)", pack: "ca_audit", subs: [
    { id: "pro.audit", label: "Audit", services: [
      S("pro.audit.statutory", "Statutory audit", ["statutory audit", "statutory auditor", "branch audit", "audit of accounts", "chartered accountant", "CA firm", "auditor + appoint|engag|empanel|selection|hiring"]),
      S("pro.audit.concurrent", "Concurrent & internal audit", ["concurrent audit", "concurrent auditor", "internal audit", "internal auditor", "revenue audit", "stock audit", "inspection audit"]),
      S("pro.audit.special", "Special audits (GST, forensic, IS)", ["GST audit", "forensic audit", "IS audit", "information systems audit", "information system + audit", "special audit", "transaction audit", "techno-financial audit", "social audit"]),
    ] },
    { id: "pro.tax", label: "Accounting & tax", services: [
      S("pro.tax.accounts", "Accounting & bookkeeping", ["accounting services", "bookkeeping", "book keeping", "finalisation of accounts", "finalization of accounts", "annual accounts", "chartered accountant", "CA firm", "accounts + accountant|CA firm|bookkeep|book keep|finalis|finaliz|preparation|maintenance of accounts|outsourc", "accounting + firm|agency|outsourc|accountant|software|support"]),
      S("pro.tax.gst", "GST & income tax", ["GST consultancy", "GST consultant", "GST return", "GST compliance", "tax consultancy", "tax consultant", "tax advisory", "tax audit", "income tax return", "income tax + consultan|advis|filing|return|assessment|chartered", "TDS + return|filing|compliance|consultan"]),
      S("pro.tax.payroll", "Payroll & compliance", ["payroll", "secretarial", "company secretary", "EPF + compliance|consultan|return|filing", "ROC + compliance|filing|return", "compliance + statutory|labour law|secretarial|RERA|chartered|tax|GST|ROC|EPF|ESI"]),
    ] },
    { id: "pro.consult", label: "Consulting", services: [
      S("pro.consult.dpr", "Financial DPR, feasibility & bid process", ["techno-economic", "techno economic", "financial feasibility", "financial viability", "financial analysis", "bid process management", "business plan", "project report + financial|bank|loan|techno"]),
      S("pro.consult.pmc", "Project monitoring units (PMU) & financial advisory", ["PMU", "project monitoring unit", "programme management unit", "program management unit", "financial advisor", "financial adviser", "financial consultant", "financial management consultant"]),
      S("pro.consult.valuation", "Valuation", ["valuer", "asset valuation", "registered valuer", "valuation + asset|property|land|share|business|fixed asset|plant|machinery|stock|inventory|company|IBBI"]),
      S("pro.consult.mgmt", "Management & HR consulting", ["management consultancy - project management consultancy", "management consultant - project management consultant", "HR consultancy", "HR consultant", "transaction advisor", "transaction adviser", "transaction advisory"]),
    ] },
    { id: "pro.legal", label: "Legal", services: [S("pro.legal.all", "Legal services", ["legal services - legal services authority", "legal advisor", "legal adviser", "legal consultant", "legal counsel", "legal retainer", "law firm", "panel lawyer", "panel advocate", "standing counsel", "advocate + empanel|panel|engag|appoint|hiring|retainer|counsel", "lawyer + empanel|panel|engag|appoint|hiring|retainer"])] },
  ] },
  { id: "eng", label: "Engineering consultancy", pack: null, subs: [
    { id: "eng.design", label: "Design & reports", services: [
      S("eng.design.dpr", "Engineering DPR, design & surveys", ["DPR", "detailed project report", "design consultancy", "detailed design", "architectural consultancy", "survey and investigation", "feasibility study", "pre-feasibility"]),
      S("eng.design.pmc", "PMC, supervision & third-party inspection", ["PMC + consultan|project management|empanel|appoint|selection", "project management consultancy", "project management consultant", "supervision consultant", "authority engineer", "independent engineer", "TPI", "third party inspection", "third-party inspection", "third party quality", "third-party quality"]),
    ] },
  ] },
  { id: "it", label: "IT & telecom", pack: "it_services", subs: [
    { id: "it.soft", label: "Software", services: [
      S("it.soft.dev", "Software & app development", ["software development", "application development", "mobile app", "ERP", "e-governance"]),
      S("it.soft.web", "Websites & portals", ["website", "web portal", "portal development"]),
      S("it.soft.data", "Data entry & digitisation", ["data entry", "digitisation", "digitization", "scanning", "document management"]),
    ] },
    { id: "it.hw", label: "Hardware & networks", services: [
      S("it.hw.supply", "Computers & peripherals", ["computer", "laptop", "desktop", "printer", "server + supply|rack|computer|IT", "UPS", "tablet"]),
      S("it.hw.network", "Networking & CCTV", ["networking", "LAN", "Wi-Fi", "CCTV", "surveillance", "camera + CCTV|surveillance|supply", "fibre", "OFC"]),
      S("it.hw.amc", "IT maintenance (AMC)", ["AMC", "annual maintenance", "comprehensive maintenance", "IT support", "facility management services"]),
    ] },
    { id: "it.cloud", label: "Cloud & security", services: [S("it.cloud.all", "Cloud, hosting, cyber security", ["cloud + service|hosting|migration|computing", "hosting", "data centre", "cyber security", "VAPT", "firewall"])] },
  ] },
  { id: "fac", label: "Facility management & manpower", pack: "it_services", subs: [
    { id: "fac.man", label: "Manpower", services: [
      S("fac.man.outsourcing", "Manpower outsourcing", ["manpower", "outsourcing", "deployment of staff", "data entry operator", "MTS", "skilled", "unskilled"]),
      S("fac.man.security", "Security services", ["security guard", "security services", "watch and ward", "ex-servicemen"]),
    ] },
    { id: "fac.soft", label: "Soft services", services: [
      S("fac.soft.housekeeping", "Housekeeping & cleaning", ["housekeeping", "cleaning", "sanitation", "mechanised cleaning", "sweeping"]),
      S("fac.soft.catering", "Catering & mess", ["catering", "mess + catering|food|running", "canteen", "food supply"]),
      S("fac.soft.pest", "Pest control & gardening", ["pest control", "fumigation", "gardening", "mali + gardening|horticulture"]),
    ] },
    { id: "fac.trans", label: "Vehicles & events", services: [
      S("fac.trans.vehicles", "Vehicle hiring", ["hiring of vehicle", "vehicle on hire", "taxi", "bus on hire", "car rental"]),
      S("fac.trans.events", "Event management", ["event management", "exhibition", "conference", "tent + pandal|event|decoration", "decoration"]),
    ] },
  ] },
  { id: "sup", label: "Supply of goods", pack: "goods_supply", subs: [
    { id: "sup.office", label: "Office & institutional", services: [
      S("sup.office.stationery", "Stationery & office supplies", ["stationery", "office supplies", "paper + A4|copier|printing|supply", "toner", "cartridge"]),
      S("sup.office.furniture", "Furniture", ["furniture", "chairs", "tables", "almirah", "steel furniture"]),
      S("sup.office.uniform", "Uniforms & textiles", ["uniform", "textile", "blanket", "bedsheet", "linen"]),
    ] },
    { id: "sup.build", label: "Construction materials", services: [
      S("sup.build.materials", "Cement, steel, bitumen, aggregates", ["cement", "steel + TMT|supply|bars|structural", "TMT", "bitumen", "emulsion", "aggregate", "sand + supply|coarse|fine", "bricks", "pipes"]),
    ] },
    { id: "sup.health", label: "Medical", services: [
      S("sup.health.equipment", "Medical equipment", ["medical equipment", "hospital equipment", "X-ray", "ventilator", "diagnostic equipment"]),
      S("sup.health.drugs", "Medicines & consumables", ["medicines", "drugs", "surgical", "consumables", "PPE"]),
    ] },
    { id: "sup.elec", label: "Electrical & electronics", services: [
      S("sup.elec.goods", "Electrical goods & lighting", ["LED", "luminaire", "cable", "wire", "switchgear", "fan + ceiling|exhaust|supply", "air conditioner"]),
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
      S("med.print.video", "Video & photography", ["videography", "photography", "documentary", "film + documentary|video|short"]),
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
      S("log.trans.freight", "Transportation & handling", ["transportation", "loading and unloading", "handling + loading|cargo|material", "carriage + goods|transport", "freight", "warehousing"]),
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

// Words that mean the tender is works or supply, not a professional service: they block a match for those packs.
export const PACK_NOT = {
  ca_audit: ["construction of", "laying", "RCC", "nali", "gali", "interlocking", "tiles", "SITC", "supply and installation", "supply, installation", "installation", "commissioning", "repair of", "repairing", "renovation", "fencing", "CAMC", "civil work", "electrical work", "jhadankam", "zadankaam",
    "energy audit", "fire audit", "safety audit", "electrical safety", "structural audit", "water audit", "green audit", "security audit", "environmental audit", "power quality", "hygiene audit", "acoustic", "CERT-In", "cyber security", "VAPT", "architectural", "driver", "post of"],
};

// One keyword as written in the taxonomy or by the user: "phrase", or "word + context|context" (the context stem must
// appear too), optionally "... - not|not" (these block it). Words in capitals (TDS, PMC) must appear in capitals.
export function parseRule(text, pack = null) {
  const [main, notPart = ""] = String(text).split(/\s+-\s+/);
  const [k, ctxPart = ""] = main.split(/\s*\+\s*/);
  const kw = k.trim();
  const list = (x) => x.split("|").map((v) => v.trim()).filter(Boolean);
  const r = { k: kw, acr: kw.split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 2 && /^[A-Z0-9]+$/.test(w) && /[A-Z]/.test(w)), ctx: list(ctxPart), not: list(notPart) };
  if (pack && PACK_NOT[pack]) r.pack = pack;
  return r;
}

// The rules a company's tender search uses: its services' words (blocked by their pack's PACK_NOT, kept in the database as
// tender_pack_not) plus its own words, minus muted ones.
export function rulesFor(serviceIds, custom = [], muted = []) {
  const off = new Set(muted.map((m) => m.toLowerCase()));
  const seen = new Set(), out = [];
  const add = (text, pack) => { const r = parseRule(text, pack); const key = r.k.toLowerCase(); if (!r.k || off.has(key) || seen.has(`${key}|${r.ctx.join("|")}`)) return; seen.add(`${key}|${r.ctx.join("|")}`); out.push(r); };
  for (const id of serviceIds) { const s = SERVICE_INDEX[id]; if (s) for (const w of s.kw) add(w, s.pack); }
  for (const w of custom) add(w, null);
  return out;
}

// Same test as the database's tender_match_words, for tests and previews.
const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const cleanTitle = (t) => String(t || "").replace(/\(\s*Ref\b[^)]*\)/gi, " ");
export function ruleHits(rule, title) {
  const t = cleanTitle(title);
  const word = (w, stem) => new RegExp(`(^|[^A-Za-z0-9])${esc(w)}${stem ? "" : "(s|es)?(?![A-Za-z0-9])"}`, "i").test(t);
  if (!word(rule.k)) return false;
  if (rule.acr.some((a) => !new RegExp(`(^|[^A-Za-z0-9])${esc(a)}(?![A-Za-z0-9])`).test(t))) return false;
  if (rule.ctx.length && !rule.ctx.some((c) => word(c, true))) return false;
  return ![...rule.not, ...(PACK_NOT[rule.pack] || [])].some((n) => word(n));
}

export function keywordsFor(serviceIds) {
  return [...new Set(serviceIds.flatMap((id) => (SERVICE_INDEX[id]?.kw || []).map((w) => parseRule(w).k)))];
}
export function labelsFor(serviceIds) {
  return serviceIds.map((id) => SERVICE_INDEX[id]?.label).filter(Boolean);
}
