import { test } from "node:test";
import assert from "node:assert/strict";
import { checkField, missingMasters, lastFys, labelKey, matchFact, placeholders, fillPlaceholders } from "../lib/masters.js";

test("answers are checked and tidied", () => {
  assert.deepEqual(checkField("pan", "abcde1234f"), { value: "ABCDE1234F" });
  assert.ok(checkField("pan", "ABC").error);
  assert.ok(checkField("bank_ifsc", "hdfc0001234").value);
  assert.deepEqual(checkField("udyam_no", "no"), { value: "NO" });
  assert.ok(checkField("constitution", "company").error);
  assert.equal(checkField("constitution", "llp").value, "llp");
  assert.ok(checkField("legal_name", "  ").error);
});

test("only what the chosen formats need, in order, once", () => {
  const now = new Date("2026-10-22");
  const q = missingMasters({ legal_name: "GSC", signatory_name: "A. Garg" }, ["covering_letter", "non_blacklisting", "turnover"], { facts: [{ key: "fin.turnover", period: "FY 2025-26", value: "100" }], now });
  assert.deepEqual(q.map((x) => x.id), ["m:city", "m:signatory_designation", "t:FY 2024-25", "t:FY 2023-24", "t:networth"]);
  assert.deepEqual(lastFys(now), ["FY 2025-26", "FY 2024-25", "FY 2023-24"]);
  const w = missingMasters({}, ["similar_works"], { counts: { works: 0 } });
  assert.ok(w.some((x) => x.kind === "work"));
  assert.ok(!missingMasters({}, ["similar_works"], { counts: { works: 2 } }).some((x) => x.kind === "work"));
});

test("format blanks become reusable master facts", () => {
  assert.equal(labelKey("Labour licence number"), "master.labour_licence_number");
  const facts = [{ key: "master.labour_licence_number", value: "LL/123" }, { key: "master.esi_code", value: "ESI-9" }];
  assert.equal(matchFact("Labour Licence Number", facts).value, "LL/123");
  assert.equal(matchFact("Number of the labour licence", facts)?.value, "LL/123");
  assert.equal(matchFact("PF code", facts), null);
  const text = "Licence: [TO BE FILLED: labour licence number]; PF: [TO BE FILLED: PF code]";
  assert.deepEqual(placeholders(text), ["labour licence number", "PF code"]);
  assert.equal(fillPlaceholders(text, facts), "Licence: LL/123; PF: [TO BE FILLED: PF code]");
});

import { classifyBlanks, fillPlaceholders as fillP, isReference } from "../lib/masters.js";

test("blanks are sorted into partner details, tables, reference pages and facts", () => {
  const t = "Annexure A\nName: [TO BE FILLED: Name of Partner 1] M.No. [TO BE FILLED: ICAI Membership Reg. No.] PAN [TO BE FILLED: PAN No. of Partner 1]\n" +
    "Partner 2: [TO BE FILLED: Name of Partner 2] [TO BE FILLED: ICAI Membership Reg. No.]\n[TO BE FILLED: Complete table with qualified CA partners/employees]\n" +
    "[TO BE FILLED: Complete table with PSU audit experience]\nFax: [TO BE FILLED: Fax number]";
  const b = classifyBlanks(t);
  assert.deepEqual(b.map((x) => [x.type, x.n || null, x.field || null]), [
    ["partner", 1, "name"], ["partner", 1, "membership_no"], ["partner", 1, "pan"], ["partner", 2, "name"], ["partner", 2, "membership_no"], ["people", null, null], ["works", null, null], ["fact", null, null],
  ]);
  const people = [{ name: "Asha Rao", designation: "Partner", qualification: "CA" }, { name: "Ankit Garg", designation: "Partner", membership_no: "512345", pan: "ABCDE1234F" }, { name: "Site Engineer", designation: "Engineer" }];
  const works = [{ work_name: "Statutory audit", client: "HSIIDC", value_inr: 250000, end_date: "2025-03-31", status: "completed" }];
  const out = fillP(t, [{ key: "master.fax_number", value: "0124-123456" }], { people, works });
  assert.match(out, /Name: Asha Rao M\.No\. \[TO BE FILLED: ICAI Membership Reg\. No\.\] PAN \[TO BE FILLED: PAN No\. of Partner 1\]/);
  assert.match(out, /Partner 2: Ankit Garg 512345/);
  assert.match(out, /2\. Ankit Garg, Partner, Membership No\. 512345/);
  assert.match(fillP("[TO BE FILLED: Name of Partner 1]", [], { people: [{ name: "Site Engineer", designation: "Engineer" }] }), /TO BE FILLED/);
  assert.match(out, /1\. Statutory audit - HSIIDC, Rs\. 2,50,000/);
  assert.match(out, /Fax: 0124-123456/);
});

test("tender pages that are not forms are reference only", () => {
  assert.ok(isReference("Tender Notice\n[TO BE FILLED: Tender Notice format template not provided in the formats list]"));
  assert.ok(isReference("[REFERENCE ONLY]"));
  assert.ok(!isReference("Certificate of acceptance\nWe accept... [TO BE FILLED: Name of firm]"));
  assert.equal(fillP("Payment Schedule [TO BE FILLED: Payment Schedule format template not provided]", []).trim(), "Payment Schedule");
});

test("partner details kept as facts stay with their partner", () => {
  const facts = [{ key: "master.icai_membership_reg_no", value: "111111" }, { key: "master.name_of_partner_1", value: "A" }, { key: "master.name_of_partner_2", value: "B" }];
  const t = "[TO BE FILLED: Name of Partner 1] [TO BE FILLED: ICAI Membership Reg. No.] / [TO BE FILLED: Name of Partner 2] [TO BE FILLED: ICAI Membership Reg. No.]";
  assert.equal(fillP(t, facts), "A 111111 / B [TO BE FILLED: ICAI Membership Reg. No.]");
  assert.equal(fillP(t, [...facts, { key: "master.icai_membership_reg_no_of_partner_2", value: "222222" }]), "A 111111 / B 222222");
});
