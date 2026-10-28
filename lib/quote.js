// Quotations (pure, tested): line items with GST → totals, intra-state CGST + SGST or inter-state IGST, amount in
// words. Used by the editor (live totals), the PDF and the client's page; the database stores what this returns.
import { rupeesInWords } from "./billing.js";

export const GST_RATES = [0, 5, 12, 18, 28];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const st = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z]/g, "");

// GSTIN's first two digits are the state code; a typed state name works too.
export function sameState(seller, buyer) {
  const code = (g) => (/^\d{2}/.test(String(g || "")) ? String(g).slice(0, 2) : null);
  const a = code(seller.gstin), b = code(buyer.gstin);
  if (a && b) return a === b;
  if (!st(buyer.state)) return true; // unknown buyer state: treat as local (CGST + SGST)
  return st(seller.state) === st(buyer.state);
}

export function normaliseLines(lines) {
  return (Array.isArray(lines) ? lines : []).slice(0, 100).map((l) => ({
    desc: String(l.desc || "").trim().slice(0, 500), hsn: String(l.hsn || "").trim().slice(0, 12),
    qty: Math.max(0, Number(l.qty) || 0), unit: String(l.unit || "").trim().slice(0, 12),
    rate: Math.max(0, Number(l.rate) || 0), gst: GST_RATES.includes(Number(l.gst)) ? Number(l.gst) : 18,
  })).filter((l) => l.desc && l.qty > 0);
}

export function computeQuote(lines, { seller = {}, buyer = {}, discount = 0 } = {}) {
  const items = normaliseLines(lines).map((l) => ({ ...l, amount: r2(l.qty * l.rate) }));
  const subtotal = r2(items.reduce((s, l) => s + l.amount, 0));
  const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const factor = subtotal ? (subtotal - disc) / subtotal : 0;
  const local = sameState(seller, buyer);
  const byRate = {};
  for (const l of items) {
    const taxable = l.amount * factor;
    const tax = (taxable * l.gst) / 100;
    byRate[l.gst] = byRate[l.gst] || { rate: l.gst, taxable: 0, tax: 0 };
    byRate[l.gst].taxable += taxable; byRate[l.gst].tax += tax;
  }
  const taxes = Object.values(byRate).filter((t) => t.rate > 0).map((t) => ({ rate: t.rate, taxable: r2(t.taxable), tax: r2(t.tax) }));
  const totalTax = r2(taxes.reduce((s, t) => s + t.tax, 0));
  const taxable = r2(subtotal - disc);
  const total = Math.round(taxable + totalTax);
  return {
    items, subtotal, discount: r2(disc), taxable, local, taxes,
    cgst: local ? r2(totalTax / 2) : 0, sgst: local ? r2(totalTax - r2(totalTax / 2)) : 0, igst: local ? 0 : totalTax,
    total_tax: totalTax, round_off: r2(total - (taxable + totalTax)), total, words: rupeesInWords(total),
  };
}
