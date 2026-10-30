import { test } from "node:test";
import assert from "node:assert/strict";
import { isoDate, fyOf, amount, constitutionOf, freeRead, needsAi, cleanExtract, mergeExtract, planApply, applyLines } from "../lib/docRead.js";

test("dates, financial years and amounts", () => {
  assert.equal(isoDate("15/04/2012"), "2012-04-15");
  assert.equal(isoDate("1 July 2017"), "2017-07-01");
  assert.equal(isoDate("2020-02-03T00:00"), "2020-02-03");
  assert.equal(fyOf("2024-25"), "FY 2024-25");
  assert.equal(fyOf("FY2023-2024"), "FY 2023-24");
  assert.equal(fyOf("31.03.2025"), "FY 2024-25");
  assert.equal(fyOf("AY 2025-26"), "FY 2024-25");
  assert.equal(amount("4,25,00,000"), 42500000);
  assert.equal(amount("₹ 4.25 Cr"), 42500000);
  assert.equal(amount("368.5 lakh"), 36850000);
  assert.equal(amount("Rs. 3,68,00,000/-"), 36800000);
  assert.equal(constitutionOf("Private Limited Company"), "private_limited");
  assert.equal(constitutionOf("Partnership"), "partnership");
});

test("GST certificate is read free", () => {
  const text = `Form GST REG-06\nRegistration Number : 06AAKFS1234K1Z5\nLegal Name : SHARMA & ASSOCIATES\nTrade Name, if any : SHARMA & ASSOCIATES CA\nConstitution of Business : Partnership\nAddress of Principal Place of Business : SCO 42, Sector 14, Gurugram, Haryana, 122001\nDate of Liability : 01/07/2017`;
  const r = freeRead("REG-GST", text);
  assert.equal(r.company.gstin, "06AAKFS1234K1Z5");
  assert.equal(r.company.pan, "AAKFS1234K");
  assert.equal(r.company.legal_name, "SHARMA & ASSOCIATES");
  assert.equal(r.company.constitution, "partnership");
  assert.equal(r.document.issued_on, "2017-07-01");
  assert.equal(needsAi("REG-GST", r, text.length + 300), false);
});

test("Udyam and incorporation certificates", () => {
  const u = freeRead("REG-UDYAM", "UDYAM REGISTRATION NUMBER UDYAM-HR-05-0012345 Type of Enterprise MICRO Date of Incorporation : 01/04/2012");
  assert.equal(u.company.udyam_no, "UDYAM-HR-05-0012345");
  assert.equal(u.company.msme_category, "micro");
  assert.equal(u.company.incorporation_date, "2012-04-01");
  const i = freeRead("REG-INC", "I hereby certify that ACME INFRA PRIVATE LIMITED is incorporated on this 12th March 2019. Corporate Identity Number U45200HR2019PTC078123");
  assert.equal(i.company.cin, "U45200HR2019PTC078123");
  assert.equal(i.company.constitution, "private_limited");
  assert.equal(i.company.incorporation_date, "2019-03-12");
});

test("financial statements and scanned copies go to AI", () => {
  assert.equal(needsAi("FIN-AUDIT", freeRead("FIN-AUDIT", "x".repeat(5000)), 5000), true);
  assert.equal(needsAi("REG-GST", freeRead("REG-GST", ""), 40), true);
  assert.equal(needsAi("REG-INC", freeRead("REG-INC", "This deed of partnership is made"), 3000), true);
});

test("AI output is cleaned", () => {
  const ex = cleanExtract({
    company: { pan: "aakfs1234k", constitution: "Partnership firm", incorporation_date: "01/04/2012", pincode: "122 001" },
    document: { period: "2024-25", issued_on: "20.09.2025" },
    facts: [{ key: "fin.turnover", period: "2024-25", value: "425.00 lakh" }, { key: "fin.net_worth", period: "31.03.2025", value: 18500000 }, { key: "made.up", period: "2024-25", value: 1 }],
    people: [{ name: "CA Rohit Sharma", role: "partner", share_pct: 60, din: "x" }, { name: "N", role: "partner" }],
    works: [{ client: "PNB", work_name: "Branch audit", value_inr: "₹32 L", end_date: "31/03/2025" }],
  });
  assert.equal(ex.company.pan, "AAKFS1234K");
  assert.equal(ex.company.constitution, "partnership");
  assert.equal(ex.company.pincode, "122001");
  assert.deepEqual(ex.facts, [{ key: "fin.turnover", period: "FY 2024-25", value: 42500000 }, { key: "fin.net_worth", period: "FY 2024-25", value: 18500000 }]);
  assert.equal(ex.people.length, 1);
  assert.equal(ex.people[0].designation, "Partner");
  assert.equal(ex.works[0].value_inr, 3200000);
  assert.equal(ex.document.issued_on, "2025-09-20");
});

test("masters: fill empty, never overwrite, conflicts listed", () => {
  const ex = { company: { pan: "AAKFS1234K", legal_name: "Sharma and Associates" }, facts: [{ key: "fin.turnover", period: "FY 2024-25", value: 42500000 }, { key: "fin.net_worth", period: "FY 2024-25", value: 18500000 }],
    people: [{ name: "Rohit Sharma", designation: "Partner", share_pct: 60 }, { name: "Neha Gupta", designation: "Partner", share_pct: 40 }], works: [{ client: "PNB", work_name: "Branch audit" }] };
  const vault = { company: { legal_name: "Sharma & Associates", pan: null }, facts: [{ key: "fin.turnover", period: "FY 2024-25", value: "42000000" }],
    people: [{ id: "p1", name: "CA Rohit Sharma", designation: "Managing Partner", share_pct: null }], works: [{ client: "PNB", work_name: "Branch Audit" }] };
  const p = planApply(ex, vault);
  assert.deepEqual(p.company, { pan: "AAKFS1234K" });
  assert.equal(p.conflicts.length, 2);
  assert.deepEqual(p.facts.map((f) => f.key), ["fin.net_worth"]);
  assert.deepEqual(p.peopleAdd.map((x) => x.name), ["Neha Gupta"]);
  assert.deepEqual(p.peopleUpdate, [{ id: "p1", name: "CA Rohit Sharma", set: { share_pct: 60 } }]);
  assert.equal(p.worksAdd.length, 0);
  assert.equal(p.count, 4);
  assert.ok(applyLines(p).some((l) => l === "Net worth FY 2024-25: ₹1.85 Cr"));
});

test("merge keeps the free reader's exact numbers", () => {
  const m = mergeExtract({ company: { gstin: "06AAKFS1234K1Z5" }, document: {}, facts: [], people: [], works: [] }, { company: { gstin: "X", city: "Gurugram" }, document: { number: "1" }, facts: [], people: [], works: [], summary: ["a"] });
  assert.deepEqual(m.company, { gstin: "06AAKFS1234K1Z5", city: "Gurugram" });
});
