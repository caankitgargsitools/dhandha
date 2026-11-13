// Knowledge base (owner, map item 9; 13 Nov): the firm's own SOPs, contract terms, policies, client FAQs, templates and
// lessons in one place. Search is free (word match, title first); "Ask" answers only from these notes. Pure and tested.

export const KINDS = { sop: "How we work (SOP)", contract: "Contract terms", policy: "Policy", faq: "Client FAQ", template: "Template", lesson: "Lesson learnt", other: "Other" };

// starters the firm can add with one tap and then edit (plain, general, no legal advice)
export const STARTERS = [
  { kind: "sop", title: "How we prepare a tender bid", tags: "tender, bid", body: "1. Shortlist the tender and read the brief in Dhandha.\n2. Check eligibility and mandatory conditions; raise pre-bid queries early.\n3. Arrange the EMD / tender fee.\n4. Fill the formats; check every document in the Vault is valid on the closing date.\n5. Work out the price in the cost planner; get the three sign-offs.\n6. Make the signed bid file; upload with the DSC at least one day before closing.\n7. Note the bid id and put the EMD on the deposit register." },
  { kind: "sop", title: "New client onboarding", tags: "client, onboarding", body: "1. Welcome call within 24 hours of the win.\n2. Collect KYC / GST / PO details.\n3. Agree the scope, contacts and the first milestone in writing.\n4. Add the work dates in Work in hand.\n5. Send the first invoice as agreed." },
  { kind: "policy", title: "Payment and collection policy", tags: "payment, invoice, collection", body: "- Invoices go out within 2 days of the milestone.\n- Reminder on the due date, then every 7 days.\n- Over 30 days overdue: the manager calls.\n- Over 60 days: hold further work after informing the client in writing." },
  { kind: "contract", title: "Our standard terms", tags: "contract, terms", body: "- Prices exclude GST unless stated.\n- Payment: 50% advance, 50% on delivery (edit to your terms).\n- Validity of quotation: 30 days.\n- Delays caused by missing client inputs extend the delivery date.\n- Disputes: courts of [your city]." },
  { kind: "faq", title: "Answers to common client questions", tags: "faq, client", body: "Q: How long does it take?\nA: [your usual time].\n\nQ: What do you need from us?\nA: [documents / access].\n\nQ: How do we pay?\nA: UPI / bank transfer; the invoice has a Pay by UPI link." },
  { kind: "sop", title: "Before closing a site visit", tags: "site, safety, field", body: "- Photos of the work done (post them in Work in hand).\n- Crew count and names.\n- Any problem flagged at once with \"Problem on site\".\n- Next visit date agreed with the client." },
];

const STOP = new Set("a an the of and or to in on for is are was be by with how what when where who why do does we our you your it this that from at as can i".split(" "));
const stem = (w) => w.replace(/(ings|ing|ies|es|s|ed)$/, "");
export const terms = (s) => [...new Set(String(s || "").toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem))];

// → [{a, score, snippet}] best first; title and tag hits count most
export function searchKb(articles = [], q = "", { kind = null, limit = 50 } = {}) {
  const want = terms(q);
  const list = articles.filter((a) => !a.archived_at && (!kind || a.kind === kind));
  if (!want.length) return list.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, limit).map((a) => ({ a, score: 0, snippet: snippetOf(a.body, []) }));
  const out = [];
  for (const a of list) {
    const t = new Set(terms(a.title)), g = new Set(terms(a.tags)), b = terms(a.body), bs = new Set(b);
    let score = 0, hit = 0;
    for (const w of want) {
      const h = (t.has(w) ? 5 : 0) + (g.has(w) ? 3 : 0) + (bs.has(w) ? 1 + Math.min(3, b.filter((x) => x === w).length - 1) * 0.3 : 0);
      if (h) hit++;
      score += h;
    }
    if (!hit) continue;
    score = score * (hit / want.length) + (a.pinned ? 0.5 : 0);
    out.push({ a, score: Math.round(score * 100) / 100, snippet: snippetOf(a.body, want) });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

export function snippetOf(body = "", want = []) {
  const text = String(body).replace(/\s+/g, " ").trim();
  if (!want.length) return text.slice(0, 160);
  const low = text.toLowerCase();
  let at = -1;
  for (const w of want) { const i = low.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return text.slice(0, 160);
  const s = Math.max(0, at - 60);
  return (s ? "…" : "") + text.slice(s, s + 160) + (s + 160 < text.length ? "…" : "");
}

// "Ask": the question with the best few notes; the answer must come only from them and name the notes used
export function askPrompt(question, hits = []) {
  const notes = hits.slice(0, 6).map((h, i) => `[${i + 1}] ${h.a.title} (${KINDS[h.a.kind] || h.a.kind})\n${String(h.a.body).slice(0, 2500)}`).join("\n\n");
  return `You answer a staff member's question using ONLY the firm's own notes below. If the notes do not answer it, say so plainly and suggest which note to write. Keep it short and practical.\n\nQuestion: ${String(question).slice(0, 500)}\n\nNotes:\n${notes}\n\nAnswer JSON only: {"answer": "...", "used": [note numbers]}`;
}
export function cleanAnswer(d, hits = []) {
  if (!d || typeof d.answer !== "string" || d.answer.trim().length < 5) return null;
  const used = (Array.isArray(d.used) ? d.used : []).map(Number).filter((n) => n >= 1 && n <= hits.length).map((n) => ({ id: hits[n - 1].a.id, title: hits[n - 1].a.title }));
  return { answer: d.answer.trim().slice(0, 2000), used };
}
