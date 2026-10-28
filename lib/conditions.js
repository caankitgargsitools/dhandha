// Eligibility conditions that are not numbers: a branch office in a state, GST registration there, ISO,
// contractor class, years in business. Found in the tender text for free (or in the AI reader's list).
// Each becomes a yes/no question keyed so that one answer, saved in Facts, serves every tender that asks it.
// Pure functions: run in server actions and in `node --test`.

export const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh", "Andaman and Nicobar", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep"];
const STATE_RX = STATES.map((s) => s.replace(/ and /g, " (?:and|&) ")).join("|") + "|Orissa|NCT of Delhi|J&K|UP|MP";
const ALIAS = { orissa: "Odisha", "nct of delhi": "Delhi", "j&k": "Jammu and Kashmir", up: "Uttar Pradesh", mp: "Madhya Pradesh" };
const canonState = (s) => ALIAS[s.toLowerCase()] || STATES.find((x) => x.toLowerCase() === s.toLowerCase().replace(/&/g, "and")) || s;
export const slug = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);

const clip = (s) => String(s).replace(/\s+/g, " ").trim().slice(0, 220);
const HERE = /\b(the )?(concerned |same |this |said )?(state|ut|union territory|district|city|area)\b/i;

// Rules, in order. Each returns zero or more {key, question, label} for a sentence.
const RULES = [
  // branch / office / establishment in a state (or "in the state" = the tender's own state)
  (s, ctx) => {
    if (!/(branch|office|establishment|presence|service cent(er|re)|depot|workshop)/i.test(s) || !/(must|should|shall|required|mandatory|necessary|essential|eligib|only)/i.test(s)) return [];
    const m = s.match(new RegExp(`(branch|office|establishment|presence|service cent(?:er|re)|depot|workshop)[^.;]{0,80}?\\b(?:in|within|at|of)\\s+(?:the\\s+)?(?:state\\s+of\\s+|ut\\s+of\\s+)?(${STATE_RX})\\b`, "i"));
    let state = m ? canonState(m[2]) : null;
    if (!state && ctx.state && new RegExp(`(branch|office|establishment|presence)[^.;]{0,60}\\b(in|within)\\s+${HERE.source}`, "i").test(s)) state = ctx.state;
    if (!state) return [];
    return [{ key: `presence.office.${slug(state)}`, label: `Branch or office in ${state}`, question: `Do you have a branch or office in ${state}?` }];
  },
  // GST registration in a state
  (s, ctx) => {
    const m = s.match(new RegExp(`GST(?:IN)?\\s+(?:registration|registered|number)[^.;]{0,50}?\\b(?:in|of|within)\\s+(?:the\\s+)?(?:state\\s+of\\s+)?(${STATE_RX})\\b`, "i"));
    let state = m ? canonState(m[1]) : null;
    if (!state && ctx.state && new RegExp(`GST(?:IN)?\\s+(?:registration|registered)[^.;]{0,40}\\b(in|within|of)\\s+${HERE.source}`, "i").test(s)) state = ctx.state;
    return state ? [{ key: `gst.state.${slug(state)}`, label: `GST registration in ${state}`, question: `Is your firm GST-registered in ${state}?` }] : [];
  },
  // ISO certificates named as a requirement
  (s) => {
    if (!/(must|should|shall|required|mandatory|valid|possess|hold|having)/i.test(s)) return [];
    return [...new Set([...s.matchAll(/\bISO[\s:-]*(9001|14001|45001|27001|20000|22000|50001)\b/gi)].map((m) => m[1]))]
      .map((n) => ({ key: `cert.iso_${n}`, label: `ISO ${n} certificate`, question: `Do you hold a valid ISO ${n} certificate?` }));
  },
  // contractor registration / enlistment, with a class when stated
  (s) => {
    const m = s.match(/(?:[Rr]egistered|[Ee]nlisted|[Ee]mpanelled)\s+(?:as\s+)?(?:an?\s+)?(?:([Cc]lass[- ]?(?:[IVX]{1,4}|[A-E]\d?|\d)|[A-E]\d?[- ][Cc]lass|[Ss]uper[- ][Cc]lass)\s+)?(?:[Cc]ivil\s+|[Ee]lectrical\s+|[Bb]uilding\s+)?[Cc]ontractors?\b[^.;]{0,40}?\b(?:with|in|of|under)\s+(?:the\s+)?([A-Z][A-Za-z&.()\/ ]{1,40}?)(?=[,.;]|\s+(?:and|or|as|for|in|on|having|with)\b|$)/);
    if (!m) return [];
    const cls = m[1] ? m[1].replace(/[- ]?class/i, "").replace(/class[- ]?/i, "").trim().toUpperCase() : null;
    const dept = m[2].trim().replace(/\s+/g, " ");
    if (dept.length < 2 || /^(the|any|state|government|appropriate|concerned)$/i.test(dept)) return [];
    return [{ key: `reg.contractor.${slug(dept)}${cls ? `.class_${slug(cls)}` : ""}`, label: `${cls ? `Class ${cls} ` : ""}contractor registration with ${dept}`, question: `Are you registered as a ${cls ? `Class ${cls} ` : ""}contractor with ${dept}?` }];
  },
  // years in business / existence
  (s) => {
    const m = s.match(/(?:at least|minimum(?: of)?|not less than|atleast)\s+(\d{1,2}|two|three|five|seven|ten)\s+years?\b[^.;]{0,60}?(existence|in (?:the )?business|since (?:its )?(?:incorporation|registration|establishment)|old|in operation|standing)/i)
      || s.match(/(existence|in (?:the )?business|in operation|incorporat\w+|establish\w+)[^.;]{0,40}?(?:at least|minimum(?: of)?|not less than|atleast)\s+(\d{1,2}|two|three|five|seven|ten)\s+years?/i);
    if (!m) return [];
    const W = { two: 2, three: 3, five: 5, seven: 7, ten: 10 };
    const raw = /^\d|^(two|three|five|seven|ten)$/i.test(m[1]) ? m[1] : m[2];
    const n = W[String(raw).toLowerCase()] ?? Number(raw);
    if (!n || n > 50) return [];
    return [{ key: `age.years_${n}`, label: `In business for at least ${n} years`, question: `Has your firm been in business for at least ${n} years?` }];
  },
];

const sentences = (text) => String(text || "").replace(/\s+/g, " ").split(/(?<=[.;:])\s+(?=[A-Z(0-9])|\s(?=\(?[ivx]{1,4}\)|\(?[a-h]\)\s)/);

// Tender pages → conditions with the page and wording they came from. ctx.state = the tender's own state.
export function extractConditions(pages, ctx = {}) {
  const out = new Map();
  (pages || []).forEach((p, i) => {
    for (const s of sentences(p)) {
      if (s.length < 15) continue;
      for (const rule of RULES) for (const c of rule(s, ctx)) if (!out.has(c.key)) out.set(c.key, { ...c, kind: "yes_no", page: i + 1, quote: clip(s) });
    }
  });
  return [...out.values()].slice(0, 12);
}

// The AI reader's "other_eligibility" lines. Recognised ones get the shared keys above; any other line becomes
// its own question, keyed on its wording so the same clause in another tender reuses the answer.
export function conditionsFromLines(lines, ctx = {}, known = []) {
  const have = new Set(known.map((c) => c.key));
  const out = [];
  for (const line of (lines || []).slice(0, 15)) {
    const hits = RULES.flatMap((r) => r(String(line), ctx));
    if (hits.length) { for (const h of hits) if (!have.has(h.key)) { have.add(h.key); out.push({ ...h, kind: "yes_no", quote: clip(line) }); } continue; }
    // numbers (turnover, solvency, net worth) and documents are checked elsewhere
    if (/turnover|solvency|net ?worth|similar work|EMD|earnest|tender fee|\bPAN\b|\bITR\b|income tax/i.test(line)) continue;
    const key = `cond.${hash(String(line).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())}`;
    if (have.has(key)) continue;
    have.add(key);
    out.push({ key, kind: "yes_no", label: clip(line).slice(0, 90), question: `Does your firm meet this condition: “${clip(line)}”?`, quote: clip(line) });
  }
  return out;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// Answers in Facts (key → "yes"/"no") against a tender's conditions.
export function checkConditions(conditions, answers) {
  const res = { met: [], failed: [], pending: [] };
  for (const c of conditions || []) {
    const a = String(answers[c.key] || "").toLowerCase();
    (a === "yes" ? res.met : a === "no" ? res.failed : res.pending).push(c);
  }
  return res;
}

// Open questions across many tenders: one per key, with the tenders that need it.
export function openQuestions(matches, answers) {
  const byKey = new Map();
  for (const m of matches) {
    for (const c of checkConditions(m.tenders?.conditions, answers).pending) {
      const q = byKey.get(c.key) || { ...c, tenders: [] };
      q.tenders.push({ match_id: m.id, title: m.tenders.title, due_at: m.tenders.due_at });
      byKey.set(c.key, q);
    }
  }
  return [...byKey.values()].sort((a, b) => b.tenders.length - a.tenders.length);
}

// The tender's mandatory conditions the bidder does not meet, from the score's reasons: preferences (industry,
// value range, preferred states), time left and document renewals are reminders, not conditions. Unanswered
// yes/no questions (ask: true) are pending, not unmet.
const SOFT = /^(outside the industries|value outside|closes in|expired:|expires before|in .* your home state)|not in your preferred states/i;
export const mandatoryUnmet = (reasons = []) => [...new Set(reasons.filter((r) => !r.ok && !r.ask && !SOFT.test(String(r.text || "").trim())).map((r) => String(r.text).trim()))];
