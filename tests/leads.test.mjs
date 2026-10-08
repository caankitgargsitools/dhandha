import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, mapHeaders, normPhone, leadsFromCsv, scoreLead, waLink, fillTemplate, listField } from "../lib/leads.js";

test("parses quoted CSV with commas, quotes and CRLF", () => {
  const rows = parseCsv('﻿Name,Notes\r\n"Sharma & Sons, Delhi","said ""call later"""\r\n\r\nB,\n');
  assert.deepEqual(rows, [["Name", "Notes"], ["Sharma & Sons, Delhi", 'said "call later"'], ["B", ""]]);
});

test("maps common Excel headers", () => {
  const m = mapHeaders(["Firm Name", "Mobile No.", "E-mail", "City", "Nature of Business"]);
  assert.deepEqual(m, { name: 0, phone: 1, email: 2, city: 3, industry: 4 });
});

test("normalises Indian numbers to 10 digits", () => {
  assert.equal(normPhone("+91 98100-12345"), "9810012345");
  assert.equal(normPhone("09810012345"), "9810012345");
  assert.equal(normPhone("12345"), "");
});

test("imports leads and skips unreachable rows", () => {
  const csv = "Company,Contact Person,Mobile,Email,City\nAravali Infra,Vikas,98100 12345,,Gurugram\nNo Contact Pvt Ltd,,,,Delhi\nMailOnly,,,a@b.in,Pune\n,Only Person,9999999999,,\n";
  const r = leadsFromCsv(csv);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.leads.map((l) => l.name), ["Aravali Infra", "MailOnly", "Only Person"]);
  assert.equal(r.leads[0].contact_person, "Vikas");
  assert.match(leadsFromCsv("Phone\n9810012345").error, /Name or Company/);
});

test("scores fit with reasons", () => {
  const ideal = { industries: ["Logistics", "Real estate"], cities: ["Gurugram"], states: ["Haryana"] };
  const hot = scoreLead({ phone: "9810012345", email: "a@b.in", contact_person: "Vikas", industry: "Real Estate developer", city: "gurugram", source: "referral" }, ideal);
  assert.equal(hot.score, 100);
  const warm = scoreLead({ phone: "9810012345", industry: "Steel trading", city: "Faridabad", state: "Haryana", source: "upload" }, ideal);
  assert.equal(warm.score, 32);
  assert.ok(warm.reasons.includes("State you serve"));
  const dnd = scoreLead({ phone: "9810012345", contact_person: "X", industry: "logistics", city: "Gurugram", dnd: true }, ideal);
  assert.equal(dnd.score, 20);
});

test("builds outreach links and templates", () => {
  assert.equal(waLink("098100 12345", "Hi there"), "https://wa.me/919810012345?text=Hi%20there");
  assert.equal(waLink("123"), null);
  assert.equal(fillTemplate("Namaste {name} of {business} — {our_company}", { contact_person: "Vikas Rao", name: "Aravali" }, { legal_name: "Garg & Co" }), "Namaste Vikas of Aravali — Garg & Co");
  assert.deepEqual(listField("Delhi, Gurugram\nDelhi,  "), ["Delhi", "Gurugram"]);
});
