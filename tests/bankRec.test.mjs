import test from "node:test";
import assert from "node:assert/strict";
import { parseDate, parseAmount, parseStatement, suggestMatches, recSummary, lineHash } from "../lib/bankRec.js";

test("dates and amounts in Indian bank formats", () => {
  assert.equal(parseDate("05/11/2026"), "2026-11-05");
  assert.equal(parseDate("5-Nov-26"), "2026-11-05");
  assert.equal(parseDate("05 Nov 2026"), "2026-11-05");
  assert.equal(parseDate("2026-11-05"), "2026-11-05");
  assert.equal(parseDate("46331"), "2026-11-05");
  assert.equal(parseDate("31/13/2026"), null);
  assert.equal(parseAmount("1,25,000.50"), 125000.5);
  assert.equal(parseAmount("(500)"), -500);
  assert.equal(parseAmount("₹ 2,000 Cr"), 2000);
  assert.equal(parseAmount(""), 0);
});

test("statement with a preamble, debit/credit columns", () => {
  const rows = [["Account No", "XXXX1234"], ["Period", "01/11/2026 to 10/11/2026"], [],
    ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
    ["03/11/26", "NEFT-ACME INDUSTRIES PVT LTD-INV2026270001", "N3051", "03/11/26", "", "59,000.00", "1,59,000.00"],
    ["04/11/26", "RTGS-EMD DFO NUH", "R11", "04/11/26", "25,000.00", "", "1,34,000.00"],
    ["", "Opening balance", "", "", "", "", ""]];
  const { lines } = parseStatement(rows);
  assert.equal(lines.length, 2);
  assert.deepEqual([lines[0].credit, lines[1].debit, lines[0].txn_date], [59000, 25000, "2026-11-03"]);
  assert.equal(lines[0].hash, lineHash(lines[0]));
  assert.ok(parseStatement([["a", "b"]]).error);
});

test("single amount column with Dr/Cr", () => {
  const { lines } = parseStatement([["Txn Date", "Description", "Amount", "Dr/Cr", "Balance"], ["2026-11-01", "UPI from Ramesh", "1500", "CR", "10000"], ["2026-11-02", "Charges", "118", "DR", "9882"]]);
  assert.deepEqual(lines.map((l) => [l.credit, l.debit]), [[1500, 0], [0, 118]]);
});

test("matching: invoice by amount + name + number, refund, EMD paid", () => {
  const lines = [
    { txn_date: "2026-11-03", narration: "NEFT-ACME INDUSTRIES PVT LTD-INV/2026-27/0001", credit: 59000, debit: 0 },
    { txn_date: "2026-11-04", narration: "RTGS-EMD DFO NUH", credit: 0, debit: 25000 },
    { txn_date: "2026-11-05", narration: "REFUND EMD FOREST", credit: 10000, debit: 0 },
    { txn_date: "2026-11-06", narration: "UPI SOMEONE", credit: 777, debit: 0 },
  ];
  const m = suggestMatches(lines, {
    invoices: [{ id: "i1", number: "INV/2026-27/0001", client_name: "Acme Industries Pvt Ltd", balance: 59000, invoice_date: "2026-10-30" }, { id: "i2", number: "INV/2026-27/0002", client_name: "Other", balance: 59000, invoice_date: "2026-10-30" }],
    deposits: [{ id: "d1", kind: "emd", status: "held", amount: 25000, paid_on: "2026-11-04", title: "DFO Nuh audit" }, { id: "d2", kind: "emd", status: "refund_due", amount: 10000, title: "Forest" }],
  });
  assert.equal(m[0].match.id, "i1");
  assert.equal(m[0].match.sure, true);
  assert.equal(m[1].match.kind, "deposit");
  assert.equal(m[2].match.kind, "refund");
  assert.equal(m[3].match, null);
  assert.deepEqual(recSummary([{ credit: 10, debit: 0, status: "matched" }, { credit: 0, debit: 5, status: "unmatched", match: {} }]), { lines: 2, in: 10, out: 5, matched: 1, unmatched: 1, ignored: 0, toCheck: 1 });
});
