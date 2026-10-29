// EMD / bank guarantee / tender-fee register (C35; pure, tested). Each deposit for a bid (bid_deposits): how it was
// paid, BG validity, refund due after the result. A lost bid's EMD / BG falls due for refund automatically (SQL
// trigger); a daily alert (private.deposit_alerts) warns about BGs expiring and refunds that are late.

export const KINDS = { emd: "EMD", bg: "Bank guarantee", fee: "Tender fee", performance_security: "Performance security", other: "Other" };
export const MODES = { online: "Online (NEFT / portal)", bg: "Bank guarantee", dd: "Demand draft", fdr: "FDR", exempt: "Exempt (MSE / Udyam)", other: "Other" };
export const STATUS = { held: ["info", "With the department"], refund_due: ["warn", "Refund due"], refunded: ["ok", "Refunded"], forfeited: ["bad", "Forfeited"], exempt: ["mute", "Exempt"], converted: ["mute", "Became performance security"] };

const day = (d) => (d ? Math.floor(Date.parse(String(d).slice(0, 10) + "T00:00:00Z") / 864e5) : null);

export function depositSummary(rows = [], today = new Date()) {
  const t = Math.floor(Date.parse(today.toISOString().slice(0, 10) + "T00:00:00Z") / 864e5);
  const sum = (xs) => xs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const held = rows.filter((r) => r.status === "held" && r.kind !== "fee");
  const due = rows.filter((r) => r.status === "refund_due");
  const late = due.filter((r) => r.refund_expected_on && day(r.refund_expected_on) < t);
  const expiring = held.filter((r) => r.valid_until && day(r.valid_until) - t <= 30);
  const refundedYear = rows.filter((r) => r.status === "refunded" && r.refunded_on && t - day(r.refunded_on) <= 365);
  return {
    held: { count: held.length, amount: sum(held) }, due: { count: due.length, amount: sum(due) },
    late: { count: late.length, amount: sum(late) }, expiring: { count: expiring.length, amount: sum(expiring) },
    refundedYear: { count: refundedYear.length, amount: sum(refundedYear) },
    feesYear: sum(rows.filter((r) => r.kind === "fee" && r.paid_on && t - day(r.paid_on) <= 365)),
  };
}

export function daysTo(d, today = new Date()) {
  if (!d) return null;
  return day(d) - Math.floor(Date.parse(today.toISOString().slice(0, 10) + "T00:00:00Z") / 864e5);
}

// a refund request letter to the department (the person edits, prints on the letterhead and sends)
export function refundLetter({ company, authority, title, ref, amount, mode, reference, paidOn }) {
  return `To,
${authority || "The Tender Inviting Authority"}

Subject: Refund of EMD — ${title || "tender"}${ref ? ` (Tender ID ${ref})` : ""}

Sir / Madam,

We had submitted our bid for the above tender and deposited an Earnest Money Deposit of ₹${Number(amount || 0).toLocaleString("en-IN")}${mode ? ` by ${mode}` : ""}${reference ? ` (reference ${reference})` : ""}${paidOn ? ` on ${paidOn}` : ""}. As the tender process is complete and our bid was not accepted, we request you to kindly refund the EMD at the earliest to our bank account on record.

Thanking you,
For ${company || "our firm"}

Authorised Signatory`;
}
