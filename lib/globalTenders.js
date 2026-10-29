// Global tenders (PENDING 38; pure, tested): World Bank procurement notices from its public API
// (search.worldbank.org/api/v2/procnotices — the source itself, no aggregator), mapped to Dhandha tenders. Fetched
// daily by /api/global/run on Vercel (cron global_tenders_daily → worker_kick). Amounts are not in rupees, so value
// is left empty; matching runs on the title and description words like any other tender.

export const WB_PORTAL = "World Bank";
export const WB_API = "https://search.worldbank.org/api/v2/procnotices";
const WANTED = /invitation for bids|request for expression of interest|request for proposals|invitation for prequalification|specific procurement notice|request for bids|request for quotations/i;
const GROUP = { GO: "goods_supply", CW: "construction" }; // consulting / non-consulting: left to the word rules

// "2026-11-14T00:00:00Z", "14-Nov-2026", "2026-11-14" (+ optional time "14:00") → ISO, or null
export function wbDate(d, time) {
  if (!d) return null;
  let s = String(d).trim();
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (m) s = `${m[3]}-${String("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()) / 3 + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const day = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = /^(\d{1,2}):(\d{2})/.exec(String(time || "")) ;
  const iso = `${day}T${t ? `${t[1].padStart(2, "0")}:${t[2]}` : "23:59"}:00Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

const txt = (v) => (v == null ? "" : String(v).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim());

export function mapWbNotice(n = {}, now = new Date()) {
  const type = txt(n.notice_type);
  if (!WANTED.test(type)) return null;
  if (n.notice_status && /cancel|award/i.test(n.notice_status)) return null;
  if (n.notice_lang_name && !/english/i.test(n.notice_lang_name)) return null; // Spanish / French notices are not for our users
  const due = wbDate(n.submission_deadline_date || n.deadline_date, n.submission_deadline_time);
  if (!due || Date.parse(due) < now.getTime()) return null;
  const title = txt(n.bid_description || n.project_name);
  if (!n.id || !title) return null;
  const country = txt(n.project_ctry_name);
  const group = String(n.procurement_group || "").toUpperCase().slice(0, 2);
  return {
    portal: WB_PORTAL, tender_ref: String(n.bid_reference_no || n.id).slice(0, 120), title: title.slice(0, 600),
    authority: (txt(n.contact_organization) || `${country} — ${txt(n.project_name)}`).slice(0, 300) || "World Bank financed project",
    department: txt(n.project_name).slice(0, 300) || null, state: country && !/^india$/i.test(country) ? `Abroad: ${country}` : null,
    category: [type, txt(n.procurement_method_name)].filter(Boolean).join(" · ").slice(0, 200),
    industry_pack: GROUP[group] || null, value_inr: null, emd_inr: null,
    published_on: (wbDate(n.noticedate || n.submission_date) || "").slice(0, 10) || null, due_at: due,
    url: `https://projects.worldbank.org/en/projects-operations/procurement-detail/${encodeURIComponent(n.id)}`,
    summary: [country && `Country: ${country}`, n.project_id && `Project ${n.project_id}`, txt(n.notice_text).slice(0, 400)].filter(Boolean).join(" · ") || null,
  };
}

export const wbUrl = (offset = 0, rows = 500) => `${WB_API}?format=json&rows=${rows}&os=${offset}&srt=noticedate&order=desc&apilang=en`;

// the API answers { procnotices: { <id>: {...} } } or { procnotices: [ ... ] }
export function wbList(json) {
  const p = json?.procnotices;
  return Array.isArray(p) ? p : p && typeof p === "object" ? Object.values(p) : [];
}
