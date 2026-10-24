// "Get ready before you file" (tested in tests/prereq.test.mjs): what a bidder has to arrange for one tender before
// starting to file — money instruments (EMD, fee, solvency), certificates and registrations, declarations and
// signatures, physical submission. Found free in the tender text; then merged with the tender's numbers, unmet
// conditions and documents missing from the Vault into one list.

export const GROUPS = {
  money: "Money and bank instruments",
  certs: "Certificates and registrations",
  sign: "Declarations and signatures",
  submit: "Submission",
  unmet: "Conditions you do not meet yet",
  vault: "Documents missing in your Vault",
};

const MODES = [
  [/demand\s+drafts?|\bD\.?D\.?\b|banker'?s\s+cheque|pay\s+order/i, "Demand draft"],
  [/bank\s+guarantee|\bB\.?G\.?\b/i, "Bank guarantee"],
  [/\bFDR\b|fixed\s+deposit/i, "FDR"],
  [/insurance\s+surety/i, "Insurance surety bond"],
  [/online|e-?payment|net\s*banking|\bNEFT\b|\bRTGS\b|payment\s+gateway/i, "Online payment"],
  [/bid\s+security\s+declaration/i, "Bid security declaration"],
];
const modesIn = (s) => MODES.filter(([rx]) => rx.test(s)).map(([, l]) => l);
const near = (text, rx, span = 320) => {
  const out = [];
  for (const m of text.matchAll(new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g"))) {
    const w = text.slice(m.index, m.index + span);
    const k = m[0].length, end = w.slice(k).search(/[.;]\s+(?=[A-Z])/); // the sentence it is in, not the next one
    out.push(end >= 0 ? w.slice(0, end + k + 1) : w);
  }
  return out.join(" ");
};
const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

const RULES = [
  { key: "solvency", group: "money", rx: /solvency\s+certificate/i,
    label: (t) => { const v = near(t, /solvency/i, 200).match(/(?:Rs\.?|₹|INR)\s*([\d,.]+)\s*(lakh|lac|crore|cr)?/i); return `Bank solvency certificate${v ? ` of ₹${v[1]}${v[2] ? ` ${v[2].toLowerCase()}` : ""}` : ""}`; } },
  { key: "bank_signature", group: "sign", rx: /signatures?\s+(?:\w+\s+){0,5}(?:verified|attested|certified)\s+by\s+(?:the\s+|your\s+|their\s+)?bank|bank(?:er)?'?s?\s+(?:verification|attestation)\s+of\s+(?:the\s+)?signatures?|signature\s+verification/i,
    label: () => "Signature verified by your bank (banker's attestation)" },
  { key: "poa", group: "sign", rx: /power\s+of\s+attorney|board\s+resolution|letter\s+of\s+authori[sz]ation|authori[sz]ation\s+letter/i,
    label: () => "Power of attorney / board resolution / authorisation for the person who signs" },
  { key: "affidavit", group: "sign", rx: /affidavit|non[-\s]?judicial\s+stamp\s+paper|notari[sz]ed/i,
    label: (t) => { const v = near(t, /stamp\s+paper/i, 120).match(/(?:Rs\.?|₹)\s*([\d,]+)/i); return `Notarised affidavit${v ? ` on ₹${v[1]} stamp paper` : " (stamp paper, notary)"}`; } },
  { key: "blacklist", group: "sign", rx: /(?:not|never)\s+been\s+(?:black[-\s]?listed|debarred|banned)|non[-\s]?black[-\s]?listing|declaration[^.]{0,60}black[-\s]?list/i,
    label: () => "Declaration that you are not blacklisted or debarred" },
  { key: "integrity_pact", group: "sign", rx: /integrity\s+pact/i, label: () => "Integrity pact, signed" },
  { key: "dsc", group: "submit", rx: /digital\s+signature\s+certificate|class\s*(?:iii|3)\s+(?:digital|DSC)|\bDSC\b/i,
    label: () => "Class III digital signature (DSC) of the signatory, with encryption" },
  { key: "iso", group: "certs", rx: /\bISO\s?[-:]?\s?(9001|14001|27001|45001|20000|22000|50001)\b/g,
    label: (t) => `ISO ${[...new Set([...t.matchAll(/\bISO\s?[-:]?\s?(9001|14001|27001|45001|20000|22000|50001)\b/g)].map((m) => m[1]))].join(" / ")} certificate, valid on the bid date` },
  { key: "peer_review", group: "certs", rx: /peer[-\s]?review(?:ed)?\s+(?:certificate|firm)|peer[-\s]?reviewed/i, label: () => "ICAI peer review certificate, valid" },
  { key: "cag", group: "certs", rx: /C\s?&\s?AG\s+empanel|empanel+ed\s+with\s+(?:the\s+)?(?:C\s?&\s?AG|CAG|comptroller)/i, label: () => "C&AG empanelment" },
  { key: "frn", group: "certs", rx: /firm\s+registration\s+(?:no|number|certificate)|ICAI\s+(?:firm\s+)?registration|constitution\s+certificate/i, label: () => "ICAI firm registration / constitution certificate" },
  { key: "epf_esi", group: "certs", rx: /\bEPFO?\b|provident\s+fund\s+registration|\bESIC?\b/, label: () => "EPF and ESI registration" },
  { key: "labour", group: "certs", rx: /labou?r\s+licen[cs]e/i, label: () => "Labour licence" },
  { key: "ca_turnover", group: "certs", rx: /turnover\s+certificate|certificate[^.]{0,40}turnover[^.]{0,60}chartered\s+accountant|chartered\s+accountant'?s?\s+certificate/i, label: () => "CA certificate of turnover (UDIN)" },
  { key: "balance_sheets", group: "certs", rx: /audited\s+(?:balance\s+sheets?|financial\s+statements|accounts|annual\s+accounts)/i,
    label: (t) => { const m = near(t, /audited\s+(?:balance|financial|accounts|annual)/i, 160).match(/(?:last|past|preceding|previous)\s+(\d|one|two|three|four|five|six|seven)\s+(?:financial\s+|f\.?y\.?\s+)?years/i); const n = m ? (words[m[1].toLowerCase()] || m[1]) : null; return `Audited balance sheets${n ? ` for the last ${n} years` : ""}`; } },
  { key: "itr", group: "certs", rx: /income\s+tax\s+returns?|\bITRs?\b/, label: () => "Income tax returns (acknowledgements)" },
  { key: "net_worth", group: "certs", rx: /net[-\s]?worth\s+certificate|positive\s+net[-\s]?worth/i, label: () => "Net worth certificate from a CA" },
  { key: "work_certs", group: "certs", rx: /completion\s+certificates?|performance\s+certificates?|satisfactory\s+(?:completion|performance)/i, label: () => "Completion / performance certificates of similar works (with work orders)" },
  { key: "hard_copy", group: "submit", rx: /(?:hard\s?copy|physical(?:ly)?|in\s+original)[^.]{0,80}(?:submit|deposit|send|reach)|(?:submit|deposit|send)[^.]{0,50}(?:in\s+original|hard\s?copy|physically)/i,
    label: () => "Originals / hard copy to be sent physically by the deadline" },
  { key: "site_visit", group: "submit", rx: /site\s+visit|site\s+inspection\s+certificate/i, label: () => "Site visit (certificate, if asked)" },
];

// what an AI line is about, to drop repeats of the items found by the rules
const SAME = { emd: /\bEMD\b|earnest|bid security/i, fee: /tender fee|document fee|cost of tender/i, ps: /performance (security|guarantee)/i,
  solvency: /solvency/i, bank_signature: /signature/i, poa: /attorney|resolution|authori[sz]ation/i, affidavit: /affidavit|stamp paper/i,
  blacklist: /black ?list|debar/i, integrity_pact: /integrity/i, dsc: /\bDSC\b|digital signature/i, iso: /\bISO\b/, peer_review: /peer review/i,
  cag: /C ?& ?AG|CAG/, frn: /firm registration|constitution/i, epf_esi: /\bEPF|\bESI/, labour: /labou?r licen/i, ca_turnover: /turnover/i,
  balance_sheets: /balance sheet|audited/i, itr: /income tax return|\bITR/i, net_worth: /net ?worth/i, work_certs: /completion|performance certificate/i,
  hard_copy: /hard ?copy|physical|original/i, site_visit: /site visit/i, prebid: /pre-?bid/i };

const SNIP = 160;
// pages: text of each page → [{ key, group, label, page, quote }]
export function findPrerequisites(pages = []) {
  const text = pages.join("\n");
  const out = [];
  for (const r of RULES) {
    const rx = new RegExp(r.rx.source, r.rx.flags.replace("g", ""));
    const page = pages.findIndex((p) => rx.test(p));
    if (page < 0) continue;
    const m = pages[page].match(rx);
    const quote = pages[page].slice(Math.max(0, m.index - 40), m.index + SNIP).replace(/\s+/g, " ").trim();
    out.push({ key: r.key, group: r.group, label: r.label(text), page: page + 1, quote });
  }
  // how EMD and the tender fee are to be paid
  const emdText = near(text, /\bEMD\b|earnest\s+money|bid\s+security(?!\s+declaration)/i);
  const feeText = near(text, /tender\s+(?:document\s+)?fee|cost\s+of\s+(?:tender|bid)\s+document/i, 220);
  const psText = near(text, /performance\s+(?:security|guarantee|bank\s+guarantee)|security\s+deposit/i, 260);
  out.push({ key: "_modes", emd: modesIn(emdText), fee: modesIn(feeText), ps: modesIn(psText).filter((x) => x !== "Bid security declaration"), mse: /\b(?:MSEs?|MSMEs?|NSIC|Udyam)\b[^.]{0,80}exempt|exempt[^.]{0,80}\b(?:MSEs?|MSMEs?|NSIC|Udyam)\b/i.test(text) });
  return out;
}

const rupees = (v) => { const n = Number(v); if (!n) return null; return n >= 1e7 ? `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, "")} crore` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2).replace(/\.?0+$/, "")} lakh` : `₹${n.toLocaleString("en-IN")}`; };

// One list for the brief, the Tenders page and the bid preparation sheet.
// found: findPrerequisites() output (stored as read.fields.prereq); fields: read fields; tender: the tenders row;
// unmet: mandatoryUnmet(reasons); checklist: [{ name, state }] of required Vault documents; msme: the firm is an MSE.
export function prerequisiteList({ found = [], fields = {}, tender = {}, detail = {}, unmet = [], checklist = [], msme = false, aiLines = [] } = {}) {
  const items = [];
  const modes = found.find((x) => x.key === "_modes") || {};
  const emd = Number(fields.emd_inr || tender.emd_inr || detail.emd_inr || 0);
  const exempt = fields.mse_emd_exempt ?? tender.mse_emd_exempt ?? modes.mse;
  if (emd > 0) {
    if (exempt && msme) items.push({ group: "money", key: "emd", label: `EMD ${rupees(emd)} — exempt for MSEs: keep your Udyam certificate ready`, done: false });
    else items.push({ group: "money", key: "emd", label: `EMD ${rupees(emd)}${modes.emd?.length ? ` as ${modes.emd.join(" / ")}` : " (check the payment mode)"}${exempt ? " — MSEs are exempt" : ""}` });
  } else if (modes.emd?.includes("Bid security declaration")) items.push({ group: "money", key: "emd", label: "Bid security declaration (instead of EMD), signed" });
  const fee = Number(fields.tender_fee_inr || detail.fee_inr || tender.fee_inr || 0);
  if (fee > 0) items.push({ group: "money", key: "fee", label: `Tender fee ${rupees(fee)}${modes.fee?.length ? ` as ${modes.fee.join(" / ")}` : ""}` });
  if (Number(fields.performance_security_pct) > 0) items.push({ group: "money", key: "ps", label: `Performance security ${fields.performance_security_pct}% of the contract value${modes.ps?.length ? ` as ${modes.ps.join(" / ")}` : ""} — on award; check your bank limit now` });
  for (const f of found) if (f.key !== "_modes") items.push({ group: f.group, key: f.key, label: f.label, page: f.page, quote: f.quote });
  if (!items.some((x) => x.key === "dsc")) items.push({ group: "submit", key: "dsc", label: "Class III digital signature (DSC) of the signatory, with encryption" });
  const prebid = tender.prebid_on || detail.prebid_on || fields.prebid_on;
  if (prebid) items.push({ group: "submit", key: "prebid", label: `Pre-bid meeting on ${String(prebid).slice(0, 10)} — send queries before it` });
  // the AI reader's own lines, unless they repeat something already listed
  for (const line of aiLines || []) {
    const l = String(line).trim();
    if (!l || items.some((x) => x.label.toLowerCase() === l.toLowerCase() || (SAME[x.key] && SAME[x.key].test(l)))) continue;
    items.push({ group: "certs", key: `ai.${items.length}`, label: l, ai: true });
  }
  for (const u of unmet) items.push({ group: "unmet", key: `unmet.${items.length}`, label: u, warn: true });
  for (const c of checklist) if (c.state !== "ok") items.push({ group: "vault", key: `vault.${c.code || c.name}`, label: `${c.name}${c.state === "expiring" ? " — renew, it expires before the bid date" : ""}`, warn: c.state === "expiring" });
  return items;
}

export function grouped(items) {
  return Object.entries(GROUPS).map(([g, title]) => ({ group: g, title, items: items.filter((x) => x.group === g) })).filter((g) => g.items.length);
}
