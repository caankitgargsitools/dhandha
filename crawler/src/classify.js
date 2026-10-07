// Puts each tender into an industry pack and pulls the state from text when the portal is national.
const PACKS = [
  ["ca_audit", /\b(audit|auditor|chartered accountant|ca firm|internal audit|concurrent audit|statutory audit|accounting|gst consultan|tax consultan|valuation)\b/i],
  ["it_services", /\b(software|hardware|it services|computer|server|network|website|portal development|manpower|outsourc|security guard|housekeeping|amc of|data entry|cctv)\b/i],
  ["goods_supply", /\b(supply of|procurement of|purchase of|rate contract for supply|delivery of)\b/i],
  ["construction", /\b(construction|road|bridge|drain|building|repair|renovation|civil work|pipeline|sewer|footpath|culvert|resurfacing|widening|strengthening|boundary wall|electrification|water supply)\b/i],
];
export function industryPack(title) {
  for (const [pack, re] of PACKS) if (re.test(title)) return pack;
  return null;
}

const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh"];
export function stateFrom(text) {
  const t = String(text || "").toLowerCase();
  return STATES.find((s) => t.includes(s.toLowerCase())) || null;
}

// "07-Oct-2026 05:00 PM" (IST) -> ISO string
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
export function parseIstDate(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/);
  if (!m) return null;
  let h = Number(m[4] || 0);
  if (m[6] === "PM" && h < 12) h += 12;
  if (m[6] === "AM" && h === 12) h = 0;
  const mon = MON[m[2].toLowerCase()];
  if (mon === undefined) return null;
  const utc = Date.UTC(Number(m[3]), mon, Number(m[1]), h, Number(m[5] || 0)) - 330 * 60000;
  return new Date(utc).toISOString();
}

// "1,23,45,678.00" / "NA" -> number or null
export function rupees(s) {
  const t = String(s || "").replace(/[₹,\s]|Rs\.?|INR/gi, "");
  if (!t || /^(na|nil|-|0\.00)$/i.test(t)) return t === "0.00" ? 0 : null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
