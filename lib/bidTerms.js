// Bid terms the tender study found (round 2, 2 Nov 2026; owner said Yes to Q14, Q16, Q18, Q20, Q23, Q24, Q25, Q29,
// Q30, Q34). Free and pure: findBidTerms(text) reads them from a tender's text, termLines() turns them into plain
// "Get ready" lines, termRisks() into "Clauses to watch".
const flat = (t) => String(t || "").replace(/[\u0001-\u0008\u000B\u000E-\u001F]+/g, " ").replace(/[ऀ-ॿ]+/g, " ").replace(/\s+/g, " ");
const near = (t, re, span = 260) => { const m = t.match(re); return m ? t.slice(Math.max(0, m.index - 40), m.index + span).trim() : null; };
const W = { one: 1, two: 2, three: 3, six: 6, twelve: 12, eighteen: 18, "twenty four": 24 };
const n = (s) => (s == null ? null : W[String(s).toLowerCase()] ?? (Number(s) || null));
const STATE_RX = /(Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Delhi)/i;

export function findBidTerms(text) {
  const t = flat(text);
  const out = {};

  // Q14 — invitation-only bids: GeM limited / single tender (seller list named or masked), or "only enlisted suppliers"
  const lim = /Limited Tender Applicable\s*:?\s*Yes/i.test(t) ? "limited" : /Single Tender Applicable\s*:?\s*Yes/i.test(t) ? "single" : null;
  if (lim) {
    const list = (t.match(/List of Seller Organi[sz]ation[^:]{0,40}:?\s*([^]{0,600}?)(?:\s{2}|Reason|Bid Details|Splitting|$)/i) || [])[1] || "";
    const names = [...list.matchAll(/(?:M\/s\.?\s*)?([A-Z][A-Za-z&.,() -]{3,80}?(?:Ltd|Limited|LLP|Pvt|Private|Bharat|Institute|University|Corporation|Company|Associates|& Co)\.?)/g)].map((m) => m[1].trim()).slice(0, 15);
    out.invite = { kind: lim, masked: /\*{3,}/.test(list) || !names.length, names };
  } else {
    const m = t.match(/\bonly\s+(?:those\s+)?(?:the\s+)?(?:enlisted|empanelled|registered|approved)\s+(?:vendors?|suppliers?|bidders?|contractors?)\s+(?:of|with|by)\s+(?:M\/s\.?\s*)?([A-Z][A-Za-z.&() -]{1,60}?)(?=\s+(?:who|which|and|are|shall|will|invited|can|may)\b|[.,;])/i)
      || t.match(/(?:invited|invitation)[^.]{0,60}\b(?:enlisted|empanelled|registered)\s+(?:vendors?|suppliers?)\s+(?:of|with)\s+(?:M\/s\.?\s*)?([A-Z][A-Za-z.&() -]{1,60}?)(?=[.,;]|\s+(?:only|and)\b)/i);
    if (m) out.invite = { kind: "enlisted", masked: false, names: [], with: m[1].trim().replace(/\s+/g, " ") };
  }

  // Q16 — the attached tender documents prevail over the GeM page
  if (/(?:tender|bid|RFQ|RFP)\s+documents?[^.]{0,60}\b(?:shall|will)\s+prevail|in case of (?:any )?(?:contradiction|conflict|discrepancy)[^.]{0,160}\b(?:tender|bid|RFQ|RFP|ATC)\s+(?:documents?|terms)?[^.]{0,40}prevail|Total Quantity[^.]{0,60}may be ignored/i.test(t)) out.docs_prevail = true;

  // Q18 / Q25 — clauses that change what is paid
  const clauses = [];
  const add = (kind, label, re) => { const q = near(t, re, 220); if (q) clauses.push({ kind, label, text: q.slice(0, 260) }); };
  add("price_fall", "Price-fall clause: if you sell the same item cheaper to any government buyer, this contract's price drops too", /price[- ]fall clause|fall in (?:the )?price[^.]{0,40}(?:any other|other) (?:government|department|organisation)/i);
  add("risk_purchase", "Risk purchase: late or failed supply is bought elsewhere at your cost", /risk (?:and cost )?purchase|at (?:the )?risk and cost of the (?:supplier|contractor|vendor|bidder)/i);
  add("price_variation", "Price variation clause (check the formula and what it is paid on)", /price variation (?:clause|formula)|PVC\b|escalation (?:clause|formula)/i);
  add("demurrage", "Ground rent / demurrage on rejected or uncollected items", /ground rent|demurrage|not (?:lifted|removed|collected) within \d+ days/i);
  add("attendance", "Attendance / punctuality penalties on staff", /(?:late|absent|absence)[^.]{0,60}(?:deduct|penalt|half[- ]day)|half[- ]day(?:'s)? (?:wage|salary)[^.]{0,40}deduct/i);
  if (/(?:revision|revised|increase) (?:in|of) (?:the )?minimum wages?[^.]{0,120}(?:no (?:extra |additional )?claim|borne by the (?:contractor|agency|bidder|service provider)|shall not be (?:paid|reimbursed))/i.test(t)) clauses.push({ kind: "wages_yours", label: "Wage rises are yours: revised minimum wages are not paid back — keep a buffer in the price", text: near(t, /revis\w* (?:minimum )?wages?|minimum wages? revision/i, 220) || "" });
  else if (/(?:revision|revised|increase) (?:in|of) (?:the )?minimum wages?[^.]{0,120}(?:reimburs|paid|borne by the (?:department|client|buyer|bank)|difference)/i.test(t)) clauses.push({ kind: "wages_paid_back", label: "Wage rises are paid back by the buyer (service charge stays fixed)", text: near(t, /revis\w* (?:minimum )?wages?|minimum wages? revision/i, 220) || "" });
  if (clauses.length) out.clauses = clauses;

  // Q20 — secrecy declaration before documents; meeting links
  if (/secrecy (?:declaration|undertaking|agreement)|non[- ]disclosure (?:declaration|undertaking)[^.]{0,80}password|password[^.]{0,80}(?:shared|provided|given)[^.]{0,60}(?:after|on receipt)/i.test(t)) {
    const by = (t.match(/(?:secrecy|declaration|undertaking)[^.]{0,160}?(?:on or before|by|before|latest by)\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?:\s+\d{1,2}[:.]\d{2})?)/i) || [])[1] || null;
    out.secrecy = { by };
  }
  const links = [...new Set([...t.matchAll(/https?:\/\/(?:teams\.microsoft\.com|teams\.live\.com|meet\.google\.com|[\w.-]*zoom\.us|[\w.-]*webex\.com)\/[^\s"'<>)]{4,300}/gi)].map((m) => m[0].replace(/[.,;]+$/, "")))].slice(0, 3);
  if (links.length) out.meeting_links = links;

  // Q23 — who must be supplied (staff profile)
  const prof = [];
  const age = t.match(/age[^.]{0,40}?(?:between|from)\s*(\d{2})\s*(?:to|and|-)\s*(\d{2})\s*years|(?:not (?:be )?(?:more|older) than|maximum age(?: of| limit)?|upper age limit(?: of)?|below)\s*(\d{2})\s*years/i);
  if (age) prof.push(age[1] ? `Age ${age[1]}–${age[2]} years` : `Age at most ${age[3]} years`);
  if (/ex[- ]?servicem[ae]n[^.]{0,40}(?:only|mandatory|compulsory|must|shall be)|(?:only|must be)[^.]{0,30}ex[- ]?servicem[ae]n/i.test(t)) prof.push("Ex-servicemen compulsory");
  else if (/ex[- ]?servicem[ae]n/i.test(t)) prof.push("Ex-servicemen preferred / optional");
  if (/lady (?:frisker|guard|security)|female (?:guard|frisker|staff)/i.test(t)) prof.push("Lady frisker / female staff needed");
  const exp = t.match(/(?:minimum|at least)\s*(\d{1,2})\s*years?(?:'|’)?\s*(?:of\s+)?(?:relevant\s+)?experience[^.]{0,40}(?:guard|staff|personnel|operator|supervisor)/i);
  if (exp) prof.push(`${exp[1]}+ years' experience for each person`);
  if (/\barmed\b[^.]{0,30}\bguards?\b/i.test(t)) prof.push("Armed guards (licensed weapons)");
  if (prof.length) out.staff_profile = prof;

  // Q24 — existing workers must be retained
  if (/(?:existing|present|current)\s+(?:workers|manpower|staff|employees|personnel|workforce)[^.]{0,120}(?:retain|continue|absorb|taken over|deploy)|retain(?:ed|ing)?\s+(?:the\s+)?(?:existing|present)\s+(?:workers|manpower|staff)/i.test(t)) out.retain_workers = true;

  // Q29 — unpaid post-audit support
  const pas = t.match(/Post[- ]Audit Support[^0-9]{0,80}(\d{1,2})/i) || t.match(/(\d{1,2})\s*months?\s+(?:of\s+)?post[- ]audit support/i);
  if (pas) out.post_audit_months = Number(pas[1]);

  // Q30 — how the bid security may (not) be paid, and how long it must stay valid
  const refused = [];
  for (const [mode, re] of [["Demand draft", /(?:demand drafts?|\bDD\b)[^.]{0,40}(?:not|shall not|will not)\s+(?:be\s+)?accepted/i], ["Physical bank guarantee", /physical (?:bank )?guarantees?[^.]{0,40}(?:not|shall not|will not)\s+(?:be\s+)?accepted/i], ["Banker's cheque", /banker'?s cheques?[^.]{0,40}(?:not|shall not)\s+(?:be\s+)?accepted/i], ["Cash", /cash[^.]{0,30}(?:not|shall not)\s+(?:be\s+)?accepted/i]]) if (re.test(t)) refused.push(mode);
  const ways = [];
  if (/\bNeSL\b|e-?BG|electronic bank guarantee/i.test(t)) ways.push("e-BG through NeSL");
  if (/SBI Collect/i.test(t)) ways.push("SBI Collect");
  if (/insurance surety bond/i.test(t)) ways.push("Insurance surety bond");
  const beyond = t.match(/(?:bid security|EMD|earnest money|bank guarantee)[^.]{0,120}?valid[^.]{0,60}?(\d{1,3})\s*days\s*(?:beyond|after|over and above)[^.]{0,30}(?:bid )?validity/i);
  if (refused.length || ways.length || beyond) out.emd_terms = { refused, ways, beyond_days: beyond ? Number(beyond[1]) : null };

  // Q34 — buyer terms that GeM's own rules forbid (GeM bids only)
  if (/GEM\/\d{4}\/[BR]\/\d+/.test(t)) {
    const gem = [];
    const st = t.match(new RegExp(`only (?:local )?(?:suppliers|bidders|vendors|firms)[^.]{0,30}(?:from|of|in|registered in)\\s+(?:the\\s+)?(?:state of\\s+)?${STATE_RX.source}`, "i"));
    if (st) gem.push({ kind: "local_only", label: `Only bidders from ${st[1]} — GeM does not allow restricting by state`, text: near(t, /only (?:local )?(?:suppliers|bidders|vendors|firms)/i, 200) });
    if (/(?:hard|physical) cop(?:y|ies)[^.]{0,80}(?:submit|send|deliver)|submit[^.]{0,60}(?:hard|physical) cop(?:y|ies)/i.test(t)) gem.push({ kind: "physical_docs", label: "Physical documents asked for — GeM bids are online only", text: near(t, /(?:hard|physical) cop(?:y|ies)/i, 200) });
    if (/samples?[^.]{0,40}(?:to be|shall be|must be)\s+(?:submitted|sent|provided)[^.]{0,40}(?:with|along with|before)\s+(?:the\s+)?(?:bid|offer)/i.test(t)) gem.push({ kind: "samples", label: "Samples with the bid — GeM forbids asking for samples before the technical evaluation", text: near(t, /samples?/i, 200) });
    if (/(?:ATC|additional terms)[^.]{0,60}(?:shall|will)\s+(?:supersede|override|prevail over)[^.]{0,40}(?:GeM|bid|all)/i.test(t)) gem.push({ kind: "atc_override", label: "Buyer terms claim to override the GeM bid — GeM says such terms are void", text: near(t, /(?:ATC|additional terms)/i, 200) });
    if (gem.length) out.gem_rule_breaks = gem;
  }
  // Q19 — GST in the price
  const gst = {};
  const conc = t.match(/concessional (?:rate of )?GST[^0-9]{0,60}?(\d{1,2}(?:\.\d+)?)\s*%|GST[^.]{0,40}concessional[^0-9]{0,40}(\d{1,2}(?:\.\d+)?)\s*%/i);
  if (conc) gst.concessional_pct = Number(conc[1] ?? conc[2]);
  if (/GST[^.]{0,120}(?:actuals?|applicable rate)[^.]{0,60}(?:whichever is lower|lower of)|(?:whichever is lower|lower of)[^.]{0,60}GST/i.test(t)) gst.lower_of = true;
  if (/reverse charge|\bRCM\b/i.test(t)) gst.reverse_charge = true;
  if (/(?:bid|price|offer)s?[^.]{0,60}(?:shall|will) be loaded|loading (?:factor|of)|loaded (?:price|value|with)/i.test(t)) gst.loading = near(t, /loaded|loading/i, 200);
  if (Object.keys(gst).length) out.gst = gst;
  // Q35 — warranty costs in IT hardware bids
  const hw = [];
  if (/(?:hard dis[kc]s?|HDDs?|SSDs?|storage media)[^.]{0,100}(?:retain|not be returned|kept by|remain with)/i.test(t)) hw.push({ kind: "disks_retained", label: "Faulty disks stay with the buyer — every replacement disk is your cost" });
  if (/service (?:cent(?:re|er)|support)[^.]{0,80}(?:each|every|all)\s+(?:consignee|state|district|location)/i.test(t)) hw.push({ kind: "service_centres", label: "A service centre or engineer in every consignee state / location" });
  if (/asset tag|(?:sticker|label)s?[^.]{0,50}(?:logo|warranty|asset)/i.test(t)) hw.push({ kind: "asset_tags", label: "Asset tags / warranty stickers on every unit" });
  if (/page (?:count|yield)/i.test(t)) hw.push({ kind: "page_count", label: "Printer warranty ends at a page count — price toner / drum replacements" });
  if (/(?:replace|replacement)[^.]{0,60}(?:entire|whole|complete)\s+(?:device|unit|machine|system)/i.test(t)) hw.push({ kind: "whole_unit", label: "Whole-unit replacement on repeated faults" });
  if (hw.length) out.hardware = hw;
  // Q36 — price basis and site
  const basis = t.match(/\b(Ex[- ]works|F\.?O\.?R\.?\s+(?:destination|site|consignee)|FOB|CIF|CIP|DDP)\b/i);
  if (basis) out.price_basis = basis[1].replace(/\s+/g, " ");
  const remote = t.match(/(\d{2,4})\s*km\.?\s*(?:from|away from)\s+(?:the\s+)?(?:nearest\s+)?(?:rail(?:way)?(?:\s*head| station)?|air(?:port|head)?)/i);
  if (remote) out.remote_km = Number(remote[1]);
  if (/loading and unloading[^.]{0,60}(?:by|of) the (?:firm|supplier|contractor|vendor)/i.test(t)) out.loading_unloading = true;
  // Q28 — the buyer's own price sheet and its rules
  const rules = [];
  if (/(?:rate|price)s?[^.]{0,40}for one year only|amount for more than one year[^.]{0,40}disqualif/i.test(t)) rules.push("Quote for one year only — a multi-year amount is disqualified");
  if (/year[- ]?wise (?:price )?break-?up|price for each year|yearly (?:price )?break-?up/i.test(t)) rules.push("Give a year-wise price break-up");
  if (/line (?:item )?total[^.]{0,40}inclusive of (?:all )?(?:taxes|GST)|total (?:amount|price)[^.]{0,30}inclusive of GST[^.]{0,30}(?:not|instead of) (?:the )?unit/i.test(t)) rules.push("Quote the line total including GST, not the unit rate");
  if (rules.length) out.price_sheet_rules = rules;
  return Object.keys(out).length ? out : null;
}

// Plain lines for "Get ready before you file".
export function termLines(x, { bidValidityDays = null } = {}) {
  if (!x) return [];
  const L = [];
  if (x.invite) L.push(x.invite.kind === "enlisted" ? `Invitation only: bids only from vendors enlisted with ${x.invite.with}` : `${x.invite.kind === "single" ? "Single" : "Limited"} tender: only invited sellers may bid${x.invite.names.length ? ` (${x.invite.names.slice(0, 4).join(", ")}${x.invite.names.length > 4 ? "…" : ""})` : ""}`);
  if (x.docs_prevail) L.push("The attached tender documents prevail over the GeM page — EMD, quantity and terms are taken from them");
  if (x.secrecy) L.push(`Email the signed secrecy declaration${x.secrecy.by ? ` by ${x.secrecy.by}` : " first"} — the technical documents' password comes after it`);
  if (x.meeting_links?.length) L.push(`Pre-bid meeting online: ${x.meeting_links[0]}`);
  if (x.retain_workers) L.push("You must retain the existing workers (see the list in the tender) — their pay and takeover cost are yours");
  if (x.staff_profile?.length) L.push(`People you must supply: ${x.staff_profile.join("; ")}`);
  if (x.post_audit_months) L.push(`${x.post_audit_months} months of post-audit support are included in the fee (unpaid)`);
  if (x.emd_terms) {
    const e = x.emd_terms;
    if (e.refused.length) L.push(`EMD: ${e.refused.join(", ")} not accepted${e.ways.length ? ` — use ${e.ways.join(" / ")}` : ""}`);
    else if (e.ways.length) L.push(`EMD by ${e.ways.join(" / ")}`);
    if (e.beyond_days) L.push(`Bid security must stay valid ${e.beyond_days} days beyond the bid validity${bidValidityDays ? ` — about ${bidValidityDays + e.beyond_days} days from the closing date` : ""}`);
  }
  return L;
}

// "Clauses to watch" entries (same shape as the reader's risks).
export function termRisks(x) {
  if (!x) return [];
  return [...(x.clauses || []).map((c) => ({ label: c.label, text: c.text })), ...(x.gem_rule_breaks || []).map((g) => ({ label: `May break GeM rules: ${g.label}`, text: g.text || "" }))];
}
