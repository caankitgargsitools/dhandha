import { test } from "node:test";
import assert from "node:assert/strict";
import { mapColumns, rowsToRecords, buildFacets } from "../lib/datasets.js";

const rows = [
  ["First Name", "Last Name", "Designation", "Company Name", "Industry", "City", "Email", "Mobile", "Employees", "Revenue band"],
  ["Neha", "Verma", "CFO", "Acme Infra", "Construction", "Gurugram", "neha@acme.in", "+91 98100 12345", "250", "50-100 Cr"],
  ["Ravi", "Sharma", "Procurement Head", "Bright Pharma", "Pharma", "Gurugram", "not-an-email", "", "1200", "500+ Cr"],
  ["", "", "", "", "", "", "", "", "", ""],
  ["Asha", "", "Owner", "Asha Foods", "Food", "Delhi", "asha@ashafoods.in", "9811122233", "40", "10-50 Cr"],
];

test("columns are recognised, the rest kept as extras", () => {
  const m = mapColumns(rows[0]);
  assert.deepEqual(Object.keys(m.core).sort(), ["city", "company", "email", "industry", "name", "phone", "role"]);
  assert.deepEqual(m.extras.map((e) => e.key), ["employees", "revenue_band"]);
});

test("records: first + last name joined, bad emails dropped, empty rows skipped", () => {
  const { records, fields, mapped } = rowsToRecords(rows);
  assert.equal(records.length, 3);
  assert.equal(records[0].name, "Neha Verma");
  assert.equal(records[1].email, null);
  assert.equal(records[0].extra.revenue_band, "50-100 Cr");
  assert.ok(mapped.includes("phone"));
  assert.ok(fields.some((f) => f.key === "employees"));
});

test("filters: repeated values become facets, unique ones do not", () => {
  const { records, fields } = rowsToRecords(rows);
  const { facets, fields: f2 } = buildFacets(records, fields);
  assert.deepEqual(facets.city, [["Gurugram", 2], ["Delhi", 1]]);
  assert.ok(facets.industry);
  assert.equal(f2.find((x) => x.key === "city").facet, true);
  assert.equal(rowsToRecords([["Foo"], ["x"]]).error, "Could not find a Name or Company column in the first row.");
});
