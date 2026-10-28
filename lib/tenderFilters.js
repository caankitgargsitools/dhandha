// Tender list filters (tested in tests/tenderFilters.test.mjs). Read from the page's URL so a filtered view can be
// bookmarked or shared; applied to the matches already loaded for the company.

export const STAGES = [["new", "New"], ["shortlisted", "Shortlisted"], ["preparing", "Preparing bid"], ["submitted", "Submitted"], ["won", "Won"], ["lost", "Lost"], ["skipped", "Skipped"]];
export const LEFT = [["3", "Closes in 3 days"], ["7", "Within a week"], ["15", "Within 15 days"], ["30", "Within a month"], ["more", "More than a month"], ["closed", "Closed"]];
export const WORK = [["construction", "Construction / civil"], ["it_services", "IT, manpower & services"], ["ca_audit", "CA / audit / accounts"], ["goods_supply", "Supply of goods"]];
export const SORTS = [["score", "Best match"], ["due", "Closing soonest"], ["value", "Highest value"], ["new", "Newest"]];
// kinds of notice: empanelments (bank branch audits, C&AG / RBI / PSU panels, consultant panels) are standing
// business — once on the panel, work keeps coming
export const KINDS = [["empanelment", "Empanelments & panels"], ["rate_contract", "Rate contracts"], ["eoi", "EOI / RFP / consultancy"]];
const KIND_RX = { empanelment: /\b(empanel+ment|empanel+ed|empanel|panel of|enlistment|registration of (chartered accountants|ca firms|consultants|vendors))\b/i,
  rate_contract: /\b(rate contract|annual rate|\barc\b)/i, eoi: /\b(eoi|expression of interest|rfp|request for proposal|consultan(cy|t))\b/i };
export const kindOf = (title) => KINDS.filter(([k]) => KIND_RX[k].test(String(title || ""))).map(([k]) => k);
export const ELIG = [["eligible", "Eligible"], ["pending", "Needs my answers"], ["unmet", "Condition not met"]];

const day = 86400000;
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp = {}) {
  const lakh = (v) => { const n = Number(one(v)); return Number.isFinite(n) && n > 0 ? n : null; };
  const pick = (v, list) => (list.some(([k]) => k === one(v)) ? one(v) : "");
  return {
    q: String(one(sp.q)).trim().slice(0, 80),
    stage: String(one(sp.stage)).split(",").filter((s) => STAGES.some(([k]) => k === s)),
    left: pick(sp.left, LEFT),
    work: pick(sp.work, WORK),
    elig: pick(sp.elig, ELIG),
    kind: pick(sp.kind, KINDS),
    portal: String(one(sp.portal)).slice(0, 60),
    state: String(one(sp.state)).slice(0, 60),
    cat: String(one(sp.cat)).slice(0, 60),
    vmin: lakh(sp.vmin), vmax: lakh(sp.vmax),
    sort: pick(sp.sort, SORTS) || "score",
  };
}

export const activeCount = (f) => ["q", "left", "work", "kind", "elig", "portal", "state", "cat", "vmin", "vmax"].filter((k) => f[k]).length + (f.stage.length ? 1 : 0);

// m: { score, eligible, pending, status, unmet, tenders: { title, authority, tender_ref, due_at, value_inr, industry_pack, portal, state, category, created_at } }
export function applyFilters(rows, f, now = Date.now()) {
  const q = f.q.toLowerCase();
  const out = rows.filter((m) => {
    const t = m.tenders;
    const left = t.due_at ? (new Date(t.due_at) - now) / day : null;
    if (q && ![t.title, t.authority, t.tender_ref, t.department].some((x) => String(x || "").toLowerCase().includes(q))) return false;
    if (f.stage.length && !f.stage.includes(m.status)) return false;
    if (f.left) {
      if (left === null) return false;
      if (f.left === "closed" ? left >= 0 : left < 0) return false;
      if (f.left === "more" ? left <= 30 : f.left !== "closed" && left > Number(f.left)) return false;
    }
    if (f.work && t.industry_pack !== f.work) return false;
    if (f.kind && !KIND_RX[f.kind].test(String(t.title || ""))) return false;
    if (f.portal && t.portal !== f.portal) return false;
    if (f.state && String(t.state || "").toLowerCase() !== f.state.toLowerCase()) return false;
    if (f.cat && !String(t.category || "").toLowerCase().includes(f.cat.toLowerCase())) return false;
    const v = Number(t.value_inr || 0) / 1e5;
    if (f.vmin && (!t.value_inr || v < f.vmin)) return false;
    if (f.vmax && t.value_inr && v > f.vmax) return false;
    if (f.elig === "eligible" && !(m.eligible && !m.pending && !m.unmet)) return false;
    if (f.elig === "pending" && !m.pending) return false;
    if (f.elig === "unmet" && !m.unmet) return false;
    return true;
  });
  const due = (m) => (m.tenders.due_at ? new Date(m.tenders.due_at).getTime() : Infinity);
  const by = {
    score: (a, b) => b.score - a.score,
    due: (a, b) => (due(a) < now) - (due(b) < now) || due(a) - due(b),
    value: (a, b) => Number(b.tenders.value_inr || 0) - Number(a.tenders.value_inr || 0),
    new: (a, b) => new Date(b.tenders.created_at || 0) - new Date(a.tenders.created_at || 0),
  }[f.sort];
  return out.sort(by);
}

// Choices for the selects, from what is actually in the list.
export function facets(rows) {
  const uniq = (fn) => [...new Set(rows.map(fn).filter(Boolean))].sort();
  return { portals: uniq((m) => m.tenders.portal), states: uniq((m) => m.tenders.state), cats: uniq((m) => m.tenders.category).slice(0, 60) };
}
