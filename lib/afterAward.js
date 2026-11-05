// After the award (brief §3.4): what a won tender needs next — performance security, the agreement, running bills and,
// when the work is done, a completion certificate and an Experience entry so the win counts for the next tender.
// Pure and tested.

const addDays = (d, n) => { const x = new Date(`${String(d).slice(0, 10)}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const rs = (n) => `Rs. ${Math.round(Number(n)).toLocaleString("en-IN")}`;

// Performance security: % of the contract value (from the reading, or GeM's ePBG %), due N days from the LoA
// (21 by the GFR / CPWD habit unless the tender says otherwise).
export function performanceSecurity({ pct = null, epbgPct = null, months = null, value = null, loaDate = null, days = 21 } = {}) {
  const p = Number(pct ?? epbgPct);
  const v = Number(value);
  if (!(p > 0) || !(v > 0)) return null;
  return { pct: p, amount: Math.round((v * p) / 100), due: loaDate ? addDays(loaDate, days) : null, months: months ? Number(months) : null };
}

// The follow-up tasks a win creates (each once): performance security, agreement, kick-off / first bill
export function awardTasks({ title = "", loaDate = null, ps = null }) {
  if (!loaDate) return [];
  const t = String(title).slice(0, 70);
  const out = [];
  if (ps) out.push({ key: "ps", title: `Submit performance security ${rs(ps.amount)} (${ps.pct}%) — ${t}`, due: ps.due, priority: "high" });
  out.push({ key: "agreement", title: `Sign the agreement — ${t}`, due: addDays(loaDate, 30), priority: "high" });
  out.push({ key: "kickoff", title: `Start the work / kick-off with the department — ${t}`, due: addDays(loaDate, 7), priority: "normal" });
  return out;
}

// The finished work as an Experience row (so "similar work" tests count it next time)
export function experienceFromWin({ tender = {}, match = {} }) {
  return {
    work_name: String(tender.title || "").slice(0, 300), client: String(tender.authority || tender.department || "").slice(0, 200) || "Government department",
    value_inr: Number(match.contract_value) || Number(match.quoted_price) || Number(tender.value_inr) || null,
    start_date: match.work_start || match.loa_date || null, end_date: match.completed_on || match.work_end || null,
    status: "completed", work_order_no: match.loa_no || null, category: "Tender won on Dhandha",
  };
}

// Request letter for the completion / performance certificate (to copy onto the letterhead)
export function completionLetter({ company = {}, tender = {}, match = {}, today = new Date() }) {
  const date = today.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return `To
${tender.authority || "The Competent Authority"}

Date: ${date}

Sub: Request for completion / performance certificate — ${tender.title || ""}${match.loa_no ? ` (Work order / LoA No. ${match.loa_no}${match.loa_date ? ` dated ${match.loa_date}` : ""})` : ""}

Dear Sir / Madam,

We, ${company.legal_name || "[firm]"}, were awarded the above work${tender.tender_ref ? ` against Tender ID ${tender.tender_ref}` : ""}. The work was started on ${match.work_start || match.loa_date || "[start date]"} and completed on ${match.completed_on || match.work_end || "[completion date]"}${match.contract_value ? ` for a contract value of ${rs(match.contract_value)}` : ""}.

We request you to kindly issue a completion / performance certificate stating the scope, value, period and the quality of work done, for our records and future bids. We also request the release of our performance security and any retention money as per the terms of the contract.

Thanking you,

For ${company.legal_name || "[firm]"}

${company.signatory_name || "Authorised Signatory"}
${company.signatory_designation || ""}`;
}
