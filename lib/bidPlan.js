// Bid plan (C36; pure, tested): the usual steps of preparing a tender bid, dated backwards from the closing time
// (and the pre-bid meeting), squeezed proportionally when little time is left. Tasks are stored in `tasks`
// (link_type 'tender'); sign-offs (technical → finance → management) in bid_signoffs.

// [title, days before closing, details]
export const STEPS = [
  ["Read the tender and note eligibility gaps", 10, "Open the assistant: brief, conditions, documents to submit."],
  ["Send pre-bid queries", null, "Tender page → Pre-bid queries. Send before the pre-bid meeting."],
  ["Arrange EMD / bank guarantee", 7, "Record it under EMD & deposits so the refund is tracked."],
  ["Collect and renew documents", 6, "Vault → Documents: anything missing or expiring before the closing date."],
  ["Fill the formats and annexures", 5, "Assistant → Your formats; open each as a form."],
  ["Work out the price", 4, "Assistant → price step (cost planner, price to win)."],
  ["Technical sign-off", 3, "Check eligibility documents and formats, then sign off below."],
  ["Finance sign-off (price approved)", 2, "Approve the price and margin."],
  ["Management sign-off", 2, "Final go-ahead to file."],
  ["Upload and submit with the DSC", 1, "Make the signed bid file, upload on the portal, keep the acknowledgement."],
];

export const SIGNOFFS = [["technical", "Technical"], ["finance", "Finance"], ["management", "Management"]];

// due: closing time; prebid: pre-bid date (yyyy-mm-dd) or null; now: Date. Returns [{ title, details, due_at }]
// "05.11.2026 15:00" / "05/11/2026" (India time) → Date, or null
export function istDate(s) {
  const m = String(s || "").match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 17), Number(m[5] ?? 0)) - 330 * 60000);
  return Number.isNaN(d.getTime()) ? null : d;
}

// terms (lib/bidTerms.js): a secrecy declaration due before the documents are given (Q20) leads the plan; an online
// pre-bid meeting's link goes on the pre-bid step
export function planTasks(due, prebid = null, now = new Date(), terms = null) {
  const close = new Date(due);
  if (Number.isNaN(close.getTime()) || close <= now) return [];
  const daysLeft = (close - now) / 864e5;
  const span = 10; // the plan is laid out over 10 days; with less time it is squeezed
  const scale = Math.min(1, Math.max(0.05, (daysLeft - 0.25) / span));
  const at = (daysBefore) => new Date(close.getTime() - daysBefore * scale * 864e5);
  const out = [];
  for (const [title, days, details] of STEPS) {
    if (days === null) {
      if (!prebid) continue;
      const pb = new Date(`${prebid}T10:00:00+05:30`);
      const send = new Date(pb.getTime() - 864e5);
      if (send <= now) continue; // too late for queries
      out.push({ title, details: terms?.meeting_links?.length ? `${details} Meeting link: ${terms.meeting_links[0]}` : details, due_at: send.toISOString(), priority: "high" });
      continue;
    }
    out.push({ title, details, due_at: at(days).toISOString(), priority: days <= 2 ? "high" : "normal" });
  }
  if (terms?.secrecy) {
    const by = istDate(terms.secrecy.by);
    const when = by && by > now ? by : new Date(Math.min(close.getTime() - 864e5 * scale * 9, now.getTime() + 864e5));
    out.unshift({ title: "Email the signed secrecy declaration", details: `In the tender's format, signed — the technical documents' password is given only after it${terms.secrecy.by ? ` (due ${terms.secrecy.by})` : ""}.`, due_at: when.toISOString(), priority: "high" });
  }
  return out;
}

// latest decision per step
export function signoffState(rows = []) {
  const s = {};
  for (const r of rows) if (!s[r.step]) s[r.step] = r; // rows newest first
  return s;
}
