import { test } from "node:test";
import assert from "node:assert/strict";
import { balance, ageing, upiLink, invoiceFromQuote } from "../lib/invoice.js";

test("balance and ageing", () => {
  assert.equal(balance({ totals: { total: 118000 }, paid_amount: 50000 }), 68000);
  const a = ageing([
    { status: "issued", totals: { total: 1000 }, due_date: "2026-11-05" },
    { status: "part_paid", totals: { total: 1000 }, paid_amount: 400, due_date: "2026-10-10" },
    { status: "issued", totals: { total: 500 }, due_date: "2026-07-01" },
    { status: "paid", totals: { total: 9999 }, due_date: "2026-01-01" },
    { status: "draft", totals: { total: 7 } },
  ], new Date("2026-10-29T08:00:00Z"));
  assert.deepEqual(a, { notDue: 1000, d0_30: 600, d31_60: 0, d61_90: 0, d90: 500, total: 2100, count: 3 });
});

test("UPI link and invoice from quotation", () => {
  assert.equal(upiLink({ upi: "gsc@okicici", name: "GSC & Co", amount: 68000, note: "INV/2026-27/0001" }), "upi://pay?pa=gsc%40okicici&pn=GSC+%26+Co&am=68000.00&cu=INR&tn=INV%2F2026-27%2F0001");
  assert.equal(upiLink({ upi: "not a upi" }), null);
  const inv = invoiceFromQuote({ id: "q1", client_name: "X", totals: { items: [{ desc: "a" }] }, status: "accepted", number: "Q/1" });
  assert.equal(inv.quote_id, "q1");
  assert.equal(inv.lines.length, 1);
  assert.equal(inv.number, undefined);
});
