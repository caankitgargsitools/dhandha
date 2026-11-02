// Eligibility sentences no rule of Dhandha understands yet (2 Nov; owner's Q11: "info specific to them must be learnt
// from fetched tenders"). The free reader keeps, per tender, the sentences that set a bidder condition but match no
// credential (lib/credentials.js), money test (lib/finTests.js) or yes/no condition (lib/conditions.js). Admin →
// Eligibility to learn groups the same requirement across tenders (crux in lib/masters.js), so frequent ones become new
// credentials / questions. Pure and tested.
import { findCredentials } from "./credentials.js";
import { findFinTests } from "./finTests.js";
import { extractConditions } from "./conditions.js";
import { sameQuestion, crux } from "./masters.js";

const ASKS = /\b(bidder|tenderer|firm|agency|applicant|contractor|vendor|supplier|company|consultant)s?\b[^.;]{0,120}\b(must|should|shall|required to|is required|are required|needs? to)\b|\b(eligib\w*|pre[- ]?qualification|qualifying criteria|minimum qualification)\b/i;
const NOT_A_CONDITION = /\b(will be (rejected|disqualified|forfeited)|reserves the right|bid security|earnest money|tender fee|pre[- ]?bid|last date|opening of|corrigendum|evaluation of|price bid|financial bid|arbitration|jurisdiction|liquidated damages|penalt|payment|invoice|delivery period|warranty period)\b/i;

const sentences = (text) => String(text || "").replace(/[\u0001-\u0008\u000B\u000E-\u001F]+/g, " ").replace(/[ऀ-ॿ]+/g, " ").replace(/\s+/g, " ")
  .split(/(?<=[.;])\s+(?=[A-Z(0-9])|\s(?=\(?[ivx]{1,4}\)\s|\(?[a-h]\)\s|\d{1,2}\.\s)/);

export function eligibilityLines(pages, max = 25) {
  const out = [];
  const seen = [];
  for (const raw of sentences((pages || []).join(" "))) {
    const s = raw.trim().replace(/^\(?([ivx]{1,4}|[a-h]|\d{1,2})[.)]\s*/i, "");
    if (s.length < 40 || s.length > 320 || !ASKS.test(s) || NOT_A_CONDITION.test(s)) continue;
    // already understood: a credential, a money test or a yes/no condition
    if (findCredentials(s).length || findFinTests(s) || extractConditions([s]).length) continue;
    if (/turnover|net ?worth|solvency|similar (work|nature)|experience of|completed works?/i.test(s)) continue; // numbers checked elsewhere
    const c = crux(s);
    if (c.toks.size < 3 || seen.some((x) => sameQuestion(x, c) >= 0.8)) continue;
    seen.push(c);
    out.push(s.slice(0, 300));
    if (out.length >= max) break;
  }
  return out;
}

// Rows from SQL eligibility_lines ({ line, tenders, example }) grouped by meaning, most-asked first.
export function groupLines(rows = [], min = 0.6) {
  const groups = [];
  for (const r of rows) {
    const c = crux(r.line);
    const g = groups.find((x) => sameQuestion(x.c, c) >= min);
    if (g) { g.tenders += Number(r.tenders) || 1; g.variants.push(r.line); if (!g.example && r.example) g.example = r.example; }
    else groups.push({ c, line: r.line, tenders: Number(r.tenders) || 1, variants: [], example: r.example || null });
  }
  return groups.sort((a, b) => b.tenders - a.tenders).map(({ c, ...g }) => g);
}
