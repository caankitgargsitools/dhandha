import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, cell, COLUMNS } from "../lib/feed.js";

test("CSV cells: quotes, commas, new lines, formula guard", () => {
  assert.equal(cell(null), "");
  assert.equal(cell(12.5), "12.5");
  assert.equal(cell("-42"), "-42");
  assert.equal(cell('Repair, "urgent"'), '"Repair, ""urgent"""');
  assert.equal(cell("a\nb"), '"a\nb"');
  assert.equal(cell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
  assert.equal(cell("+91 98100"), "'+91 98100");
});

test("rows in the fixed column order", () => {
  const csv = toCsv([{ Name: "A & Co", Phone: "98100", Score: 70, Extra: "ignored" }], ["Name", "Phone", "Score"]);
  assert.equal(csv, "Name,Phone,Score\r\nA & Co,98100,70\r\n");
  assert.ok(COLUMNS.tenders.includes("Closes") && COLUMNS.leads.includes("Next follow-up"));
});
