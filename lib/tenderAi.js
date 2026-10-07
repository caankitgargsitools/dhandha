import "server-only";
import { runJson } from "./ai";

const DOC_CODES = "REG-PAN, REG-GST, REG-INC, REG-MOA, REG-UDYAM, REG-NSIC, REG-STARTUP, FIN-ITR, FIN-AUDIT, FIN-CA-CERT, FIN-SOLV, EXP-WO, EXP-CC, CERT-ISO, CERT-EPF, CERT-ESI, CERT-LAB, CERT-CONTR, CERT-ICAI, CERT-PEER, LEG-POA, DSC";

const PROMPT = `You are reading an Indian government tender document for a bidder. It may be in English, Hindi or a regional language; always answer in English.
Return ONE JSON object with these keys (use null when the document does not say):
{
 "summary": [5 to 8 short plain-English lines: what the work is, where, value, EMD, deadline, who is eligible, anything unusual],
 "value_inr": number (estimated cost in rupees),
 "emd_inr": number,
 "mse_emd_exempt": true/false/null,
 "req_avg_turnover": number in rupees (convert % of estimated cost to rupees),
 "turnover_years": number,
 "req_similar_one": number in rupees (one similar work), "req_similar_two": number, "req_similar_three": number,
 "req_similar_years": number,
 "similar_work_definition": string,
 "due_at": ISO datetime with +05:30, "prebid_on": "YYYY-MM-DD",
 "completion_period": string, "bid_validity_days": number, "performance_security_pct": number,
 "other_eligibility": [strings: registrations, licences, class of contractor, net worth, solvency amount, etc.],
 "required_docs": [codes from: ${DOC_CODES}],
 "formats": [{"title": string, "page": number}] (every annexure / form / format / schedule the bidder must fill),
 "risks": [{"label": string, "text": short quote, "page": number}] (penalties, LD, no escalation, unlimited liability, short timelines),
 "language": string,
 "pages": {"<field name>": page number where you found it}
}
Use only what the document says. Do not invent numbers.`;

export async function aiReadTender({ supabase, tenantId, pdf, text }) {
  return runJson({
    supabase, tenantId, task: "tender_read", pdf, text, prompt: PROMPT, private: false, maxTokens: 6000,
    validate: (d) => (!Array.isArray(d.summary) || d.summary.length < 2 ? "no summary" : null),
  });
}
