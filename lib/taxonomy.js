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
      S("pro.audit.statutory", "Statutory audit", ["!statutory audit", "!statutory auditor", "branch audit", "audit of accounts", "!chartered accountant", "!CA firm", "audit firm + appoint|engag|empanel|selection|hiring|consulting", "audit agency + appoint|engag|empanel|selection|hiring", "auditor + appoint|engag|empanel|selection|hiring"]),
      S("pro.audit.concurrent", "Concurrent & internal audit", ["!concurrent audit", "!concurrent auditor", "!internal audit", "!internal auditor", "revenue audit", "revenue assurance", "stock audit", "inspection audit"]),
      S("pro.audit.special", "Special audits (GST, forensic, IS)", ["GST audit", "forensic audit", "IS audit", "information systems audit", "information system + audit", "special audit", "transaction audit", "!techno-financial audit", "!techno financial audit", "!techno financial auditor", "social audit"]),
      S("pro.audit.cost", "Cost audit", ["!cost audit", "!cost auditor", "!cost accountant", "cost accounting + firm|records|audit|appoint", "cost records"]),
      S("pro.audit.bank", "Bank audits", ["bank audit", "credit audit", "stock and receivables audit", "stock & receivables", "KYC audit", "inspection of branches", "revenue leakage"]),
    ] },
    { id: "pro.tax", label: "Accounting & tax", services: [
      S("pro.tax.accounts", "Accounting & bookkeeping", ["accounting services", "bookkeeping", "book keeping", "finalisation of accounts", "finalization of accounts", "annual accounts", "!chartered accountant", "!CA firm", "accounts personnel", "accounts + accountant|CA firm|bookkeep|book keep|finalis|finaliz|preparation|maintenance of accounts|outsourc", "accounting + firm|agency|outsourc|accountant|software|support|personnel"]),
      S("pro.tax.gst", "GST & income tax", ["GST consultancy", "GST consultant", "GST return", "GST compliance", "tax consultancy", "tax consultant", "tax advisory", "tax audit", "income tax return", "income tax + consultan|advis|filing|return|assessment|chartered", "TDS + return|filing|compliance|consultan"]),
      S("pro.tax.payroll", "Payroll & compliance", ["payroll", "secretarial", "company secretary", "EPF + compliance|consultan|return|filing", "ROC + compliance|filing|return", "compliance + statutory|labour law|secretarial|RERA|chartered|tax|GST|ROC|EPF|ESI"]),
      S("pro.tax.cert", "CA certificates (UC, net worth, turnover)", ["utilisation certificate", "utilization certificate", "net worth certificate", "turnover certificate", "certification + chartered|CA firm|accountant|utilisation|utilization|net worth|turnover|financial"]),
    ] },
    { id: "pro.consult", label: "Consulting", services: [
      S("pro.consult.dpr", "Financial DPR, feasibility & bid process", ["techno-economic", "techno economic", "financial feasibility", "financial viability", "financial analysis", "bid process management", "business plan", "project report + financial|bank|loan|techno"]),
      S("pro.consult.pmc", "Project monitoring units (PMU) & financial advisory", ["PMU + financ|account|audit|fiscal|treasury|budget|PFMS|DBT|tax|GST|revenue|loan|bank|fund|expenditure|grant", "project monitoring unit + financ|account|audit|fiscal|treasury|budget|PFMS|DBT|tax|GST|revenue|loan|bank|fund|expenditure|grant", "programme management unit + financ|account|audit|fiscal|treasury|budget|PFMS|DBT|tax|GST|revenue|loan|bank|fund|expenditure|grant", "program management unit + financ|account|audit|fiscal|treasury|budget|PFMS|DBT|tax|GST|revenue|loan|bank|fund|expenditure|grant", "!financial advisor", "!financial adviser", "!financial advisory", "!financial consultant", "!financial management consultant"]),
      S("pro.consult.valuation", "Valuation", ["valuer", "asset valuation", "!registered valuer", "valuation + asset|property|land|share|business|fixed asset|plant|machinery|stock|inventory|company|IBBI"]),
      S("pro.consult.mgmt", "Management & HR consulting", ["management consultancy - project management consultancy|project management consultant|technology|software|digital|architect|engineering|e-governance", "management consultant - project management consultancy|project management consultant|technology|software|digital|architect|engineering|e-governance", "HR consultancy", "HR consultant", "!transaction advisor", "!transaction adviser", "!transaction advisory"]),
      S("pro.consult.ibc", "Insolvency & restructuring", ["insolvency professional", "resolution professional", "!liquidator", "IRP", "IBC + professional|resolution|insolvency", "restructuring + financial|debt|loan"]),
      S("pro.consult.esg", "ESG, BRSR & sustainability reporting", ["ESG", "BRSR", "sustainability report", "sustainability reporting", "integrated report", "carbon accounting"]),
      S("pro.consult.actuary", "Actuarial valuation", ["actuarial", "actuary", "actuarial valuation"]),
    ] },
    { id: "pro.legal", label: "Legal", services: [S("pro.legal.all", "Legal services", ["legal services - legal services authority", "legal advisor", "legal adviser", "legal consultant", "legal counsel", "legal retainer", "law firm", "panel lawyer", "panel advocate", "standing counsel", "advocate + empanel|panel|engag|appoint|hiring|retainer|counsel", "lawyer + empanel|panel|engag|appoint|hiring|retainer"])] },
  ] },
  { id: "eng", label: "Engineering consultancy", pack: null, subs: [
    { id: "eng.design", label: "Design & reports", services: [
      S("eng.design.dpr", "Engineering DPR, design & surveys", ["DPR", "detailed project report", "design consultancy", "detailed design", "architectural consultancy", "survey and investigation", "feasibility study", "pre-feasibility"]),
      S("eng.design.pmc", "PMC, supervision & third-party inspection", ["PMC + consultan|project management|empanel|appoint|selection", "project management consultancy", "project management consultant", "supervision consultant", "authority engineer", "independent engineer", "TPI", "third party inspection", "third-party inspection", "third party quality", "third-party quality"]),
      S("eng.design.arch", "Architecture & town planning", ["architect + appoint|empanel|selection|consultan|services", "architectural", "master plan", "town planning", "urban planning", "urban design"]),
      S("eng.design.struct", "Structural design & audit", ["structural audit", "structural design", "structural stability", "structural consultant", "NDT", "non-destructive"]),
      S("eng.design.mep", "MEP & HVAC design", ["MEP + design|consultan", "HVAC design", "plumbing design", "electrical design"]),
    ] },
    { id: "eng.survey", label: "Surveys, GIS & testing", services: [
      S("eng.survey.land", "Topographical, DGPS & drone surveys", ["topographical survey", "topographic survey", "DGPS", "total station", "drone survey", "LiDAR", "aerial survey", "land survey"]),
      S("eng.survey.gis", "GIS & mapping", ["GIS", "mapping + GIS|digital|property|asset", "geospatial", "remote sensing"]),
      S("eng.survey.geo", "Soil, geotechnical & material testing", ["soil investigation", "soil testing", "geotechnical", "material testing", "NABL + testing|lab", "load test", "core cutting"]),
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
    { id: "it.more", label: "IT consulting, AV & telecom", services: [
      S("it.more.consult", "IT consulting & system integration", ["IT consultancy", "IT consultant", "system integrator", "system integration", "IT PMU", "PMU + IT|technology|digital|e-governance", "software licence", "software license"]),
      S("it.more.av", "Smart classrooms, AV & video conferencing", ["smart class", "smart classroom", "interactive panel", "interactive flat panel", "projector", "video conferencing", "audio visual", "PA system", "digital podium"]),
      S("it.more.telecom", "Telecom & towers", ["telecom", "mobile tower", "GPON", "FTTH", "telephone exchange", "EPABX"]),
    ] },
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
      S("fac.soft.laundry", "Laundry & linen", ["laundry", "washing of linen", "dry cleaning"]),
    ] },
    { id: "fac.tech", label: "Technical maintenance", services: [
      S("fac.tech.lifts", "Lifts & escalators", ["lift + maintenance|AMC|CAMC|installation|supply", "elevator", "escalator"]),
      S("fac.tech.hvac", "HVAC & air conditioning O&M", ["HVAC", "air conditioning plant", "AC plant", "chiller", "air conditioner + maintenance|AMC|repair|servicing"]),
      S("fac.tech.fire", "Fire fighting & alarm systems", ["fire fighting", "fire-fighting", "fire alarm", "fire hydrant", "sprinkler", "fire detection"]),
      S("fac.tech.om", "Plant & building O&M", ["operation and maintenance", "O&M + plant|STP|WTP|building|system", "comprehensive maintenance contract"]),
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
      S("sup.other.safety", "Fire & safety equipment", ["fire extinguisher", "safety equipment", "safety shoes", "helmet", "safety gear"]),
      S("sup.other.sports", "Sports & gym equipment", ["sports goods", "sports equipment", "gym equipment", "fitness equipment", "playground equipment"]),
      S("sup.other.books", "Books & library", ["books + supply|purchase|library", "library books", "e-books", "journals + subscription|supply"]),
      S("sup.other.kitchen", "Kitchen & catering equipment", ["kitchen equipment", "commercial kitchen", "utensils", "cooking range"]),
    ] },
  ] },
  { id: "ene", label: "Energy & environment", pack: null, subs: [
    { id: "ene.solar", label: "Solar & power", services: [
      S("ene.solar.plants", "Solar plants & rooftop", ["solar", "rooftop", "solar power plant", "solar pump", "PV"]),
      S("ene.solar.dg", "DG sets & power backup", ["DG set", "generator", "power backup", "inverter"]),
      S("ene.solar.ev", "EV charging", ["EV charging", "charging station", "electric vehicle + charging|supply"]),
      S("ene.solar.audit", "Energy audit & efficiency", ["energy audit", "energy efficiency", "BEE", "energy conservation"]),
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
  { id: "fin", label: "Financial services & revenue collection", pack: null, subs: [
    { id: "fin.ins", label: "Insurance & banking", services: [
      S("fin.ins.insurance", "Insurance & broking", ["insurance broker", "insurance + policy|cover|mediclaim|group|scheme", "mediclaim", "group personal accident", "GPA policy", "health insurance"]),
      S("fin.ins.bank", "Banking & payment services", ["banking partner", "banker + appoint|selection", "cash management", "business correspondent", "payment gateway", "POS machine"]),
    ] },
    { id: "fin.collect", label: "Revenue collection", services: [
      S("fin.collect.toll", "Toll, parking & fee collection", ["toll collection", "toll plaza", "user fee collection", "parking fee", "fee collection", "collection agency", "market fee"]),
      S("fin.collect.tax", "Tax & dues recovery", ["property tax + survey|collection|assessment", "recovery agent", "recovery of dues", "revenue collection"]),
    ] },
  ] },
  { id: "hos", label: "Hospitality, travel & tourism", pack: null, subs: [
    { id: "hos.all", label: "Hospitality & travel", services: [
      S("hos.all.hotel", "Hotels, guest houses & canteens (operation)", ["guest house + operation|running|management", "hotel + operation|management|running", "circuit house", "rest house + operation|management"]),
      S("hos.all.travel", "Travel agency & ticketing", ["travel agent", "travel agency", "air ticket", "air tickets", "ticketing"]),
      S("hos.all.tourism", "Tourism promotion & operation", ["tourism + promotion|operation|consultan|circuit", "tour operator", "heritage + operation|walk|promotion"]),
    ] },
  ] },
  { id: "mfg", label: "Manufacturing & fabrication", pack: null, subs: [
    { id: "mfg.fab", label: "Fabrication & engineering goods", services: [
      S("mfg.fab.steel", "Steel structures & fabrication", ["fabrication", "steel structure", "structural steel", "MS structure", "shed + fabrication|steel|PEB", "PEB"]),
      S("mfg.fab.machining", "Machining, castings & spares", ["machining", "casting", "forging", "spares + manufacture|fabrication|machined"]),
    ] },
  ] },
  { id: "min", label: "Mining & minerals", pack: null, subs: [
    { id: "min.ops", label: "Mining operations", services: [
      S("min.ops.mining", "Mining & overburden removal", ["mining", "overburden", "OB removal", "excavation + coal|mine|mineral", "MDO"]),
      S("min.ops.coal", "Coal & mineral handling and transport", ["coal handling", "coal transportation", "transportation of coal", "mineral transportation", "sand mining"]),
    ] },
  ] },
  { id: "hlt", label: "Healthcare operations", pack: null, subs: [
    { id: "hlt.ops", label: "Hospital operations", services: [
      S("hlt.ops.ppp", "Hospital O&M & PPP", ["hospital + operation|management|PPP|O&M", "operation of hospital", "health centre + operation|management"]),
      S("hlt.ops.camps", "Health camps & telemedicine", ["health camp", "medical camp", "telemedicine", "tele-medicine", "mobile medical unit"]),
    ] },
  ] },
  { id: "res", label: "Research, surveys & evaluation (social sector)", pack: null, subs: [
    { id: "res.eval", label: "Studies & evaluation", services: [
      S("res.eval.study", "Baseline, impact & evaluation studies", ["baseline survey", "baseline study", "impact assessment", "impact evaluation", "evaluation study", "endline", "third party evaluation", "concurrent evaluation"]),
      S("res.eval.survey", "Socio-economic & household surveys", ["socio-economic survey", "household survey", "census + survey|enumeration", "field survey", "research study"]),
      S("res.eval.monitor", "Third-party monitoring (schemes)", ["third party monitoring", "third-party monitoring", "monitoring and evaluation", "M&E agency"]),
    ] },
  ] },
  { id: "hrx", label: "Recruitment & examinations", pack: null, subs: [
    { id: "hrx.all", label: "Recruitment & exams", services: [
      S("hrx.all.recruit", "Recruitment agency", ["recruitment agency", "recruitment + process|agency|outsourcing", "placement agency"]),
      S("hrx.all.exam", "Exam conduct & evaluation", ["examination + conduct|agency|online|CBT", "CBT", "computer based test", "OMR", "evaluation of answer", "question paper"]),
    ] },
  ] },
];

export const SERVICE_INDEX = Object.fromEntries(TAXONOMY.flatMap((i) => i.subs.flatMap((s) => s.services.map((v) => [v.id, { ...v, sub: s.label, industry: i.label, industryId: i.id, pack: i.pack }]))));

// Words that mean the tender is works or supply, not a professional service: they block a match for those packs.
export const PACK_NOT = {
  ca_audit: ["construction of", "laying", "RCC", "nali", "gali", "interlocking", "tiles", "SITC", "supply and installation", "supply, installation", "installation", "commissioning", "repair of", "repairing", "renovation", "fencing", "CAMC", "civil work", "electrical work", "jhadankam", "zadankaam", "architectural", "driver", "post of"],
};
// Always block, even an unmistakable ("!") phrase: audits and roles that are not financial work. In the database as
// tender_pack_not pack "<pack>_hard".
export const PACK_HARD = {
  ca_audit: ["energy audit", "fire audit", "safety audit", "electrical safety", "structural audit", "water audit", "green audit", "security audit", "environmental audit", "power quality", "hygiene audit", "acoustic", "CERT-In", "cyber security", "VAPT", "air audit", "SAP"],
};

// One keyword as written in the taxonomy or by the user: "phrase", or "word + context|context" (the context stem must
// appear too), optionally "... - not|not" (these block it). Words in capitals (TDS, PMC) must appear in capitals.
export function parseRule(text, pack = null) {
  const strong = String(text).startsWith("!");
  const [main, notPart = ""] = String(text).replace(/^!/, "").split(/\s+-\s+/);
  const [k, ctxPart = ""] = main.split(/\s*\+\s*/);
  const kw = k.trim();
  const list = (x) => x.split("|").map((v) => v.trim()).filter(Boolean);
  const r = { k: kw, acr: kw.split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 2 && /^[A-Z0-9]+$/.test(w) && /[A-Z]/.test(w)), ctx: list(ctxPart), not: list(notPart) };
  if (pack && PACK_NOT[pack]) r.pack = pack;
  if (strong) r.strong = true;
  return r;
}

// The rules a company's tender search uses: its services' words (blocked by their pack's PACK_NOT, kept in the database as
// tender_pack_not) plus its own words, minus muted ones.
export function rulesFor(serviceIds, custom = [], muted = [], index = SERVICE_INDEX) {
  const off = new Set(muted.map((m) => m.toLowerCase()));
  const seen = new Set(), out = [];
  const add = (text, pack) => { const r = parseRule(text, pack); const key = r.k.toLowerCase(); if (!r.k || off.has(key) || seen.has(`${key}|${r.ctx.join("|")}`)) return; seen.add(`${key}|${r.ctx.join("|")}`); out.push(r); };
  for (const id of serviceIds) { const s = index[id]; if (s) for (const w of s.kw) add(w, s.pack); }
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
  return ![...rule.not, ...(rule.strong ? [] : PACK_NOT[rule.pack] || []), ...(PACK_HARD[rule.pack] || [])].some((n) => word(n));
}

export function keywordsFor(serviceIds, index = SERVICE_INDEX) {
  return [...new Set(serviceIds.flatMap((id) => (index[id]?.kw || []).map((w) => parseRule(w).k)))];
}
export function labelsFor(serviceIds) {
  return serviceIds.map((id) => SERVICE_INDEX[id]?.label).filter(Boolean);
}

// The catalogue a company sees: the built-in list plus additions from taxonomy_custom (approved ones from everyone,
// and the company's own pending ones). Custom ids are "x.<uuid>". Returns { tree, index } shaped like TAXONOMY /
// SERVICE_INDEX. A custom service under a built-in industry takes that industry's pack.
export function buildCatalog(rows = []) {
  const tree = TAXONOMY.map((i) => ({ ...i, subs: i.subs.map((s) => ({ ...s, services: [...s.services] })) }));
  const xid = (r) => `x.${r.id}`;
  const mark = (r) => ({ custom: true, status: r.status, mine: !!r.mine });
  const live = rows.filter((r) => r.status !== "rejected" || r.mine);
  for (const r of live.filter((r) => r.kind === "industry")) tree.push({ id: xid(r), label: r.label, pack: null, subs: [], ...mark(r) });
  const industry = (id) => tree.find((i) => i.id === id);
  for (const r of live.filter((r) => r.kind === "sub")) industry(r.parent)?.subs.push({ id: xid(r), label: r.label, services: [], ...mark(r) });
  const sub = (id) => tree.flatMap((i) => i.subs.map((s) => ({ s, i }))).find((x) => x.s.id === id);
  for (const r of live.filter((r) => r.kind === "service")) {
    const at = sub(r.parent);
    if (at) at.s.services.push({ id: xid(r), label: r.label, kw: (r.keywords || []).length ? r.keywords : [r.label], ...mark(r) });
  }
  const index = Object.fromEntries(tree.flatMap((i) => i.subs.flatMap((s) => s.services.map((v) => [v.id, { ...v, sub: s.label, industry: i.label, industryId: i.id, pack: i.pack ?? null }]))));
  return { tree, index };
}

// Search the catalogue by industry, sub-industry, service or keyword. Returns [{ type, industry, sub?, service? }],
// industries first, at most `limit`.
export function searchCatalog(tree, query, limit = 30) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  const has = (t) => String(t || "").toLowerCase().includes(q);
  const out = [];
  for (const i of tree) {
    if (has(i.label)) out.push({ type: "industry", industry: i });
    for (const s of i.subs) {
      if (has(s.label)) out.push({ type: "sub", industry: i, sub: s });
      for (const v of s.services) if (has(v.label) || v.kw.some((w) => has(parseRule(w).k))) out.push({ type: "service", industry: i, sub: s, service: v });
    }
  }
  const order = { industry: 0, sub: 1, service: 2 };
  return out.sort((a, b) => order[a.type] - order[b.type]).slice(0, limit);
}
