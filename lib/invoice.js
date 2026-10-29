// Sales invoices (C41; pure, tested): balance, receivables ageing, UPI payment link. Totals come from computeQuote
// (lib/quote.js) — the same GST maths as quotations. SQL: invoice_save / invoice_issue / invoice_payment_add /
// invoice_view, daily private.invoice_daily (repeat invoices, reminder tasks).

export const STATUS = { draft: ["mute", "Draft"], issued: ["info", "Issued"], part_paid: ["warn", "Part paid"], paid: ["ok", "Paid"], cancelled: ["mute", "Cancelled"] };
export const MODES = { upi: "UPI", neft: "NEFT / RTGS", cheque: "Cheque", cash: "Cash", card: "Card", other: "Other" };

export const total = (inv) => Number(inv?.totals?.total) || 0;
export const balance = (inv) => Math.max(0, Math.round((total(inv) - (Number(inv?.paid_amount) || 0)) * 100) / 100);

const dayNum = (d) => Math.floor(Date.parse(String(d).slice(0, 10) + "T00:00:00Z") / 864e5);

// money still to come in, by how late it is
export function ageing(invoices = [], today = new Date()) {
  const t = dayNum(today.toISOString());
  const b = { notDue: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90: 0, total: 0, count: 0 };
  for (const i of invoices) {
    if (!["issued", "part_paid"].includes(i.status)) continue;
    const bal = balance(i);
    if (!bal) continue;
    const late = i.due_date ? t - dayNum(i.due_date) : 0;
    const k = late <= 0 ? "notDue" : late <= 30 ? "d0_30" : late <= 60 ? "d31_60" : late <= 90 ? "d61_90" : "d90";
    b[k] += bal; b.total += bal; b.count += 1;
  }
  return b;
}

// opens the payer's UPI app with the amount filled in (works on phones)
export function upiLink({ upi, name, amount, note }) {
  if (!upi || !/^[\w.-]{2,64}@[\w.-]{2,64}$/.test(upi)) return null;
  const p = new URLSearchParams({ pa: upi, pn: String(name || "").slice(0, 50), am: (Math.round(Number(amount) * 100) / 100).toFixed(2), cu: "INR", tn: String(note || "").slice(0, 60) });
  return `upi://pay?${p.toString()}`;
}

export function invoiceFromQuote(q = {}) {
  const keep = ["lead_id", "client_name", "client_contact", "client_address", "client_gstin", "client_state", "client_email", "client_phone", "subject", "discount", "terms"];
  return { ...Object.fromEntries(keep.map((k) => [k, q[k] ?? ""])), quote_id: q.id || "", lines: q.totals?.items?.length ? q.totals.items : q.lines || [] };
}
