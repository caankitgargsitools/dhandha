import test from "node:test";
import assert from "node:assert/strict";
import { payLine, runTotals, bankSheet, missingBank, activeIn, daysIn, rupeesInWords } from "../lib/payroll.js";

const s = { id: "a", name: "Ramesh", gross: 20000, basic_pct: 50, pf: true, esi: true, pt: 200, tds: 0, bank_account: "1234", ifsc: "SBIN0001" };

test("full month: PF on basic, ESI under 21,000, PT", () => {
  const l = payLine(s, {}, "2026-11");
  assert.equal(l.days, 30);
  assert.equal(l.basic, 10000);
  assert.equal(l.pf_emp, 1200);
  assert.equal(l.esi_emp, 150);
  assert.equal(l.esi_er, 650);
  assert.equal(l.net, 20000 - 1200 - 150 - 200);
  assert.equal(l.ctc, 20000 + 1200 + 650);
});

test("part month, high earner: PF capped, no ESI, advance", () => {
  const l = payLine({ ...s, gross: 60000, basic_pct: 40 }, { days: 15, advance: 5000 }, "2026-11");
  assert.equal(l.earned, 30000);
  assert.equal(l.basic, 12000);
  assert.equal(l.pf_emp, 1440);
  assert.equal(l.esi_emp, 0);
  assert.equal(l.net, 30000 - 1440 - 200 - 5000);
  assert.equal(payLine({ ...s, gross: 80000, basic_pct: 50 }, {}, "2026-11").pf_emp, 1800);
  assert.equal(payLine({ ...s, pf: false }, { days: 0 }, "2026-11").net, 0);
});

test("month helpers, totals, bank sheet, words", () => {
  assert.equal(daysIn("2027-02"), 28);
  const st = [{ id: 1, joined_on: "2026-12-01" }, { id: 2, left_on: "2026-10-31" }, { id: 3, joined_on: "2026-11-10" }];
  assert.deepEqual(activeIn(st, "2026-11").map((x) => x.id), [3]);
  const lines = [payLine(s, {}, "2026-11"), payLine({ ...s, id: "b", name: "=Sita", bank_account: "" }, {}, "2026-11")];
  const t = runTotals(lines);
  assert.equal(t.people, 2);
  assert.equal(t.pf_due, 4800);
  const csv = bankSheet(lines, "2026-11");
  assert.equal(csv.split("\n").length, 2);
  assert.deepEqual(missingBank(lines), ["=Sita"]);
  assert.equal(rupeesInWords(18450), "Rupees Eighteen thousand four hundred fifty only");
  assert.equal(rupeesInWords(1234567), "Rupees Twelve lakh thirty-four thousand five hundred sixty-seven only");
});
