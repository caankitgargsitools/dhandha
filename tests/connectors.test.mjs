import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPlace, mapApolloPerson } from "../lib/connectors.js";

test("a Google Maps place becomes a lead", () => {
  const l = mapPlace({
    id: "p1", displayName: { text: "Sharma & Co. Chartered Accountants" }, formattedAddress: "SCO 12, Sector 14, Gurugram, Haryana 122001",
    addressComponents: [{ longText: "Gurugram", types: ["locality", "political"] }, { longText: "Haryana", types: ["administrative_area_level_1"] }],
    nationalPhoneNumber: "0124 400 1234", websiteUri: "https://sharmaco.in", rating: 4.6, userRatingCount: 38, primaryTypeDisplayName: { text: "Accounting" },
  }, { industry: "Chartered accountants" });
  assert.equal(l.name, "Sharma & Co. Chartered Accountants");
  assert.equal(l.city, "Gurugram");
  assert.equal(l.state, "Haryana");
  assert.equal(l.phone, "0124 400 1234");
  assert.equal(l.industry, "Chartered accountants");
  assert.match(l.notes, /Google rating 4.6 \(38 reviews\)/);
});

test("an Apollo person becomes a lead at their company", () => {
  const l = mapApolloPerson({ id: "a1", first_name: "Neha", last_name_obfuscated: "Ve***a", title: "Finance Head", city: "Noida", state: "Uttar Pradesh",
    linkedin_url: "http://www.linkedin.com/in/neha", email: "email_not_unlocked@domain.com", organization: { name: "Acme Infra Pvt Ltd", primary_domain: "acmeinfra.in", industry: "construction", estimated_num_employees: 250 } });
  assert.equal(l.name, "Acme Infra Pvt Ltd");
  assert.equal(l.contact_person, "Neha Ve***a");
  assert.equal(l.email, null);
  assert.equal(l.website, "https://acmeinfra.in");
  assert.match(l.notes, /Finance Head/);
});
