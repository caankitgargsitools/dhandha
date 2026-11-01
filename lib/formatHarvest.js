// The learned format catalogue (pure, tested). Every tender Dhandha reads — a customer's reading, the automatic
// pre-check, or the scheduled "harvest" of a few tenders a day across industries — hands its formats here. Each format is
// cleaned (the tender's own reference, name of work and authority become {placeholders}; underscores and dotted lines
// become [TO BE FILLED: …] boxes; page footers and broken lines are tidied), checked that it really is a form, tagged with
// the industry, and given a fingerprint (min-hash of word triples) so the same annexure seen in another tender counts as
// a repeat instead of a new entry. A format nobody has seen before becomes a new catalogue entry.
import { normaliseBlanks } from "./masters.js";
import { formatId } from "./tenderRules.js";
import { matchTemplates } from "./formatTemplates.js";
import { classifyFormat } from "./formatLibrary.js";

// Industries for the catalogue filter, from the tender's title, portal category and pack.
export const SECTORS = {
  works: { label: "Civil works & construction", re: /\b(construct|civil|road|building|bridge|repair|renovat|maintenance of (building|road)|drain|sewer|pipeline|irrigation|canal|flooring|plaster|painting work|boundary wall)/i },
  electrical: { label: "Electrical & mechanical", re: /\b(electric|electrical|solar|transformer|substation|lift|elevator|HVAC|air[- ]condition|DG set|pump|street ?light|cabling|wiring)/i },
  it: { label: "IT, software & hardware", re: /\b(software|IT |information technology|computer|laptop|server|network|website|portal|data cent|cyber|CCTV|ERP|digiti[sz]|cloud|printer)/i },
  audit: { label: "Audit, CA & accounting", re: /\b(audit|chartered accountant|accounting|accounts|GST (return|consult)|tax (consult|return)|book[- ]?keeping|internal control|valuation|forensic)/i },
  consultancy: { label: "Consultancy & advisory", re: /\b(consult|advis|DPR|PMC|feasibility|study|survey|research|transaction advisor|project management|third party inspection|TPI|evaluation)/i },
  manpower: { label: "Manpower, security & facility", re: /\b(manpower|security (guard|service|agency)|housekeeping|outsourc|facility management|cleaning|sanitation|guards?|data entry operator|staff on contract)/i },
  medical: { label: "Medical, drugs & hospital", re: /\b(drug|medicine|pharma|hospital|medical|surgical|diagnostic|laboratory|reagent|vaccine|ayush|health)/i },
  transport: { label: "Vehicles & transport", re: /\b(vehicle|taxi|cab|hiring of (car|bus|vehicle)|transport|bus|truck|logistic|ambulance)/i },
  catering: { label: "Catering, events & printing", re: /\b(catering|canteen|mess|food|event|exhibition|printing|stationery|hospitality)/i },
  supply: { label: "Supply of goods", re: /\b(supply|procurement of|purchase of|providing and fixing|furniture|equipment|items?|materials?)/i },
};
const PACK_SECTOR = { construction: "works", goods_supply: "supply", it_services: "it", ca_audit: "audit" };

export function sectorOf({ title = "", category = "", industry_pack = "" } = {}) {
  const text = `${title} ${category}`;
  for (const [k, s] of Object.entries(SECTORS)) if (s.re.test(text)) return k;
  return PACK_SECTOR[industry_pack] || "other";
}
export const sectorLabel = (k) => SECTORS[k]?.label || "Other";

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Joins the broken lines PDFs give ("form\npart\nof\nonline" → "form part of online"), drops page footers.
function tidy(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/g, ""));
  const out = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (/^(page\s*)?\d+\s*(of|\/)\s*\d+$/i.test(l) || /^-?\s*\d{1,3}\s*-?$/.test(l)) continue; // "Page 3 of 40", "- 12 -"
    if (/⟦/.test(l)) { out.push(l); continue; }
    const prev = out[out.length - 1];
    // a short fragment that continues the sentence above (lower-case start, previous line not finished)
    if (prev !== undefined && prev !== "" && l && /^[a-z(,]/.test(l) && !/[.:;?!]$/.test(prev) && !/^\d+[.)]|^[a-z][.)]\s/.test(l) && !/⟦/.test(prev)) out[out.length - 1] = `${prev} ${l}`;
    else out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// The tender's own particulars → placeholders, so the format fits any tender.
export function genericise(text, tender = {}) {
  let t = tidy(text);
  const swap = (val, ph) => {
    const v = String(val || "").replace(/\s*\(Ref[^)]*\)\s*$/i, "").trim();
    if (v.length >= 6) t = t.replace(new RegExp(esc(v).replace(/\s+/g, "\\s+"), "gi"), ph);
  };
  swap(tender.tender_ref, "{tender_ref}");
  swap(tender.title, "{tender_title}");
  swap(tender.authority, "{authority}");
  if (tender.department && tender.department !== tender.authority) swap(tender.department, "{authority}");
  t = t.replace(/\b\d{4}_[A-Z0-9]+_\d+_\d+\b/g, "{tender_ref}"); // GePNIC tender ids
  return normaliseBlanks(t);
}

// Does this look like a form someone fills or signs (and not a page of terms, or garbage from a scan)?
export function formQuality(text) {
  const t = String(text || "");
  const lines = t.split("\n").filter((l) => l.trim());
  if (t.length < 150 || lines.length < 4) return 0;
  const words = t.split(/\s+/).filter(Boolean);
  const oneWord = lines.filter((l) => l.trim().split(/\s+/).length === 1).length / lines.length;
  const junk = (t.match(/[^\x20-\x7E\nऀ-ॿ₹⟦⟧–—’“”‘•]/g) || []).length / t.length;
  let s = 0;
  if (/\[TO BE FILLED|\{(legal_name|tender_ref|authority)\}/.test(t)) s += 30;
  if (/\b(name of (the )?(bidder|firm|tenderer|agency|company)|signature|authori[sz]ed signatory|seal|place\s*:|date\s*:)/i.test(t)) s += 30;
  if (/\b(I\/We|we hereby|I hereby|we certify|we declare|undertake|do hereby|solemnly)/i.test(t)) s += 20;
  if (/⟦table|S\.?\s?No\.?|Sl\.?\s?No\.?/i.test(t)) s += 15;
  if (/\b(shall be|the contractor shall|the bidder shall|the employer|clause \d)/gi.test(t) && (t.match(/\bshall\b/gi) || []).length > 12) s -= 30; // terms and conditions, not a form
  if (oneWord > 0.4) s -= 40;
  if (junk > 0.02) s -= 30;
  if (words.length > 3000) s -= 20;
  return Math.max(0, Math.min(100, s));
}

// The heading without its number: "Annexure 9 - Format for SA 8000 Compliance" → "Format for SA 8000 Compliance";
// a bare "Form 8" takes the first real line of the text ("Curriculum Vitae (CV) of Professional / Key Personnel").
export function headingOf(title, text = "") {
  const strip = (s) => String(s || "").replace(/^\s*(annexure|annex|appendix|attachment|form|format|proforma|schedule)[\s.:-]*([A-Z]{0,5}[\s-]?[0-9]{1,3}[A-Z]?|[IVXivx]{1,5}|[A-Z])\b(\s*\([a-z0-9]{1,4}\))?[\s.:\-–—)]*/i, "").replace(/\s+/g, " ").trim();
  let h = strip(title);
  if (h.length < 4) {
    const line = String(text).split("\n").map((l) => strip(l.trim())).find((l) => l.length >= 6 && l.length <= 140 && /^[A-Za-z]/.test(l) && !/^(to be|on|in|continued)\b/i.test(l));
    h = line || String(title || "Format").trim();
  }
  return nice(h.replace(/[.:;,\-–—]+$/, "")).slice(0, 140);
}
// ALL-CAPS headings read as Title Case; short words and abbreviations (MSE, GST, CA) stay as they are
const SMALL = new Set(["of", "for", "the", "and", "or", "to", "in", "on", "by", "a", "an", "with", "from", "as", "at"]);
function nice(h) {
  if (h.replace(/[^a-z]/g, "").length > h.replace(/[^A-Z]/g, "").length / 3) return h;
  return h.toLowerCase().split(" ").map((w, i) => (/^(mse|msme|gst|pan|emd|bg|ca|cv|it|ngo|jv|poa|oem|maf|epf|esi|esic|iso|udin|dsc|nit|rfp|eoi|tor|boq|sla|psu|hsn|sac|tds|fin|tech)$/.test(w.replace(/[^a-z]/g, "")) ? w.toUpperCase() : i && SMALL.has(w) ? w : w.replace(/[a-z]/, (c) => c.toUpperCase()))).join(" ");
}
export const titleKey = (h) => String(h || "").toLowerCase().replace(/\b(format|proforma|form|of|for|the|a|an|to|be|on|in|and|by|from|regarding|submitted|furnished)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).sort().join(" ").slice(0, 120);

// Min-hash of word triples (32 numbers): two formats with ≥ ~80% of the same wording share most of them.
const HASHES = 32;
function h32(str, seed) {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h ^ (h >>> 15)) >>> 0;
}
export function minhash(text) {
  const words = String(text).toLowerCase().replace(/\[to be filled[^\]]*\]|\{[a-z_]+\}|[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const grams = new Set();
  for (let i = 0; i + 2 < words.length; i++) grams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  if (!grams.size) grams.add(words.join(" "));
  const out = new Array(HASHES).fill(0x7fffffff);
  for (const g of grams) for (let k = 0; k < HASHES; k++) { const v = h32(g, k * 7919) & 0x7fffffff; if (v < out[k]) out[k] = v; }
  return out;
}
export const similarity = (a, b) => (a?.length && b?.length ? a.filter((v, i) => v === b[i]).length / Math.min(a.length, b.length) : 0);

// How it is executed, from its own words.
export function execOf(text) {
  const t = String(text);
  if (/\b(bank guarantee|guarantor bank|we,? the bank|SFMS)\b/i.test(t)) return "bank";
  if (/\b(affidavit|deponent|stamp paper|non[- ]judicial|notar)/i.test(t)) return "stamp";
  if (/\b(UDIN|chartered accountant'?s? (letterhead|certificate)|statutory auditor)/i.test(t)) return "ca";
  if (/\b(manufacturer'?s? authori[sz]ation|OEM)\b/i.test(t)) return "oem";
  return null;
}

// Every format of one reading → the items the catalogue stores (only real forms, cleaned, fingerprinted).
export function harvestItems(formats, tender = {}) {
  const sector = sectorOf(tender);
  const seen = new Set();
  const items = [];
  for (const f of formats || []) {
    const raw = String(f?.text || "");
    if (raw.length < 150) continue;
    const body = genericise(raw, tender).slice(0, 12000);
    const quality = formQuality(body);
    if (quality < 40) continue;
    const heading = headingOf(f.title, body);
    // a sentence picked up as a heading ("can be clubbed together…", "Schedule of payments in duplicate and in accordance with…")
    if (/^[a-z]/.test(heading) || heading.split(/\s+/).length > 12) continue;
    const key = titleKey(heading);
    if (!key || seen.has(key + body.length)) continue;
    seen.add(key + body.length);
    const tpl = matchTemplates(heading, body)[0];
    const kind = tpl?.type || classifyFormat(heading, body);
    if (kind === "reference") continue; // contract forms and conditions are not filled with the bid
    items.push({
      heading, title_key: key, ident: formatId(f.title), type: kind, sector, exec: execOf(body),
      body, minhash: minhash(body), quality, tender_id: tender.id || null, portal: tender.portal || null, authority: tender.authority || null, state: tender.state || null,
    });
  }
  return items.slice(0, 40);
}

// Learned entries that fit a heading in a tender, best first (the tender's industry first, then how often seen).
export function suggestLearned(title, text, entries, { sector, limit = 3 } = {}) {
  const heading = headingOf(title, text);
  const want = new Set(titleKey(heading).split(" ").filter((w) => w.length > 2));
  if (!want.size) return [];
  const scored = [];
  for (const e of entries || []) {
    const have = new Set(String(e.title_key || "").split(" ").filter((w) => w.length > 2));
    let common = 0;
    for (const w of want) if (have.has(w)) common++;
    const score = common / Math.max(want.size, have.size);
    if (score < 0.5) continue;
    scored.push({ e, score: score + ((e.sectors || []).includes(sector) ? 0.2 : 0) + Math.min(0.2, Math.log10(1 + Number(e.seen_count || 1)) / 10) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.e);
}
