import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrom, isAutomated, phoneIn, bodyText, companyFromDomain, leadFromEmail, appsScript } from "../lib/emailLead.js";

test("sender name and address", () => {
  assert.deepEqual(parseFrom('"Ravi Kumar" <Ravi@Acme.in>'), { name: "Ravi Kumar", email: "ravi@acme.in" });
  assert.deepEqual(parseFrom("ravi@acme.in"), { name: "", email: "ravi@acme.in" });
  assert.equal(parseFrom("not an email").email, "");
});

test("automatic mail is skipped", () => {
  assert.equal(isAutomated({ email: "no-reply@bank.com", subject: "Statement" }), "automatic sender");
  assert.equal(isAutomated({ email: "a@b.com", subject: "Out of office: back Monday" }), "automatic reply");
  assert.equal(isAutomated({ email: "a@b.com", subject: "Hi", headers: { "List-Unsubscribe": "<mailto:x>" } }), "mailing list");
  assert.equal(isAutomated({ email: "me@myfirm.in", subject: "Hi" }, ["myfirm.in"]), "your own domain");
  assert.equal(isAutomated({ email: "ravi@acme.in", subject: "Need GST audit quote" }), "");
});

test("phone numbers in Indian formats", () => {
  assert.equal(phoneIn("Call me on +91 98765 43210 today"), "9876543210");
  assert.equal(phoneIn("Mob: 09876543210"), "9876543210");
  assert.equal(phoneIn("919876543210"), "9876543210");
  assert.equal(phoneIn("Order 123456789012 and PIN 110001"), "");
});

test("quoted replies are cut and company comes from a business domain", () => {
  assert.equal(bodyText("Please quote.\n\nOn Mon, 1 Jan 2026 at 10:00, X <x@y.in> wrote:\n> old"), "Please quote.");
  assert.equal(companyFromDomain("acme-infra.co.in"), "Acme Infra");
  assert.equal(companyFromDomain("gmail.com"), "");
});

test("lead row from an email", () => {
  const r = leadFromEmail({ from: "Ravi Kumar <ravi@acme-infra.co.in>", subject: "Statutory audit for FY 25-26", text: "Hello, please share your fee. 98765-43210", message_id: "m1" });
  assert.equal(r.row.name, "Acme Infra");
  assert.equal(r.row.contact_person, "Ravi Kumar");
  assert.equal(r.row.phone, "9876543210");
  assert.equal(r.row.website, "https://acme-infra.co.in");
  assert.match(r.row.notes, /^Email enquiry: Statutory audit/);
  const g = leadFromEmail({ from: "Sita <sita@gmail.com>", subject: "Hi", text: "" });
  assert.equal(g.row.name, "Sita");
  assert.equal(g.row.website, null);
  assert.equal(leadFromEmail({ from: "noreply@x.com", subject: "x" }).skip, "automatic sender");
});

test("apps script carries the address and key as strings", () => {
  const s = appsScript({ url: "https://d.app/api/email/lead/abc", key: 'k"1' });
  assert.ok(s.includes('var URL = "https://d.app/api/email/lead/abc";'));
  assert.ok(s.includes('var KEY = "k\\"1";'));
  assert.ok(s.includes("everyMinutes(5)"));
});
