// Pre-bid queries (C38; pure, tested). Free first: the eligibility check already knows where the firm falls short or
// what is unclear (match reasons) — each becomes a polite query / relaxation request. Then, if the firm wants, a paid AI
// reads the whole tender for restrictive or unclear clauses (prebidPrompt, 5 credits). The result is the usual
// pre-bid query table (S.No · clause / page · tender says · query · why) to send before the pre-bid meeting.

const cr = (n) => `₹${(Number(n) / 1e7).toFixed(2).replace(/\.?0+$/, "")} crore`;
const strip = (s) => String(s || "").replace(/^Does your firm meet this condition:\s*“?/i, "").replace(/”?\?$/, "").trim();

// tender: { req_avg_turnover, req_similar_one, emd_inr, mse_emd_exempt }; reasons: match reasons; firm: { msme, startup }
export function freeQueries({ tender = {}, reasons = [], firm = {} } = {}) {
  const out = [];
  const add = (clause, says, query, why) => out.push({ clause, says, query, why });
  for (const r of reasons) {
    const t = String(r.text || "");
    if (r.ok) continue;
    if (/turnover/i.test(t) && tender.req_avg_turnover) {
      add("Eligibility — average annual turnover", `Average turnover of ${cr(tender.req_avg_turnover)}`,
        `We request that the average turnover requirement be reduced to ${cr(tender.req_avg_turnover * 0.6)} (60%), or that a consortium / JV be allowed to meet it jointly.`,
        "This allows capable MSEs to compete and widens participation, as encouraged by the Public Procurement Policy for MSEs and GFR 2017.");
    } else if (/similar work/i.test(t) && tender.req_similar_one) {
      add("Eligibility — similar work experience", `Similar work of ${cr(tender.req_similar_one)}`,
        "We request that similar work done for PSUs, government bodies and reputed private organisations be accepted, and that the value of ongoing work completed up to the bid date be counted.",
        "Firms with relevant experience in the same field can then qualify; the quality of work is unaffected.");
    } else if (r.ask) {
      const cond = strip(t);
      add("Eligibility condition", cond, `Please clarify whether this condition is mandatory and what document is accepted as proof. If possible, we request its relaxation or an equivalent: "${cond.slice(0, 160)}".`,
        "The condition is not clear in the document; a clarification avoids rejection of otherwise eligible bids.");
    }
  }
  if (firm.msme && tender.emd_inr > 0 && !tender.mse_emd_exempt) {
    add("EMD", `EMD of ₹${Number(tender.emd_inr).toLocaleString("en-IN")}`, "Please confirm that MSEs registered on Udyam are exempt from EMD and tender fee for this tender.",
      "Public Procurement Policy for MSEs Order 2012 (as amended) exempts registered MSEs from EMD and tender fee.");
  }
  if (firm.startup) {
    add("Eligibility — prior turnover and experience", "Prior turnover / experience criteria", "Please confirm the relaxation of prior turnover and prior experience for DPIIT-recognised startups.",
      "Ministry of Finance guidance allows relaxing these criteria for startups in public procurement, subject to quality and technical specifications.");
  }
  return out.map((q, i) => ({ n: i + 1, page: "", source: "free", ...q }));
}

export function prebidPrompt({ tender, firm, already = [] }) {
  return `You help an Indian bidder prepare PRE-BID QUERIES for the attached government tender.
Find clauses that are restrictive for this bidder, unclear, contradictory, or missing information a bidder needs (eligibility, scope, payment terms, penalties, timelines, evaluation, EMD / performance security). For each, write a short, polite query or relaxation request the department can answer.
Rules: cite the clause number and page where you can; quote the tender's words briefly; no more than 12 queries; most important first; do not invent clauses; plain formal English.
Tender: ${JSON.stringify(tender).slice(0, 2000)}
Bidder (for what is restrictive for them): ${JSON.stringify(firm).slice(0, 4000)}
Already drafted (do not repeat): ${already.map((q) => q.query).join(" | ").slice(0, 2000)}
Answer as JSON: {"queries": [{"clause": "...", "page": "12", "says": "...", "query": "...", "why": "..."}]}`;
}

export function cleanQueries(d) {
  const list = Array.isArray(d?.queries) ? d.queries : null;
  if (!list?.length) return null;
  return list.filter((q) => q && q.query).slice(0, 12).map((q) => ({
    clause: String(q.clause || "").slice(0, 160), page: String(q.page ?? "").slice(0, 20), says: String(q.says || "").slice(0, 400),
    query: String(q.query).slice(0, 800), why: String(q.why || "").slice(0, 400), source: "ai" }));
}

// the table as plain text, ready to paste into the department's format or an email
export function queriesText(queries = [], { firm, tender } = {}) {
  const lines = queries.map((q, i) => `${i + 1}. ${q.clause}${q.page ? ` (page ${q.page})` : ""}\n   Tender says: ${q.says}\n   Query / request: ${q.query}\n   Reason: ${q.why}`);
  return `Pre-bid queries${tender ? ` — ${tender}` : ""}${firm ? `\nFrom: ${firm}` : ""}\n\n${lines.join("\n\n")}`;
}
