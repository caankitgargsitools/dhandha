import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, siteDefaults, jsonLd, telHref, cleanSiteText } from "../lib/site.js";

test("web address from the firm name", () => {
  assert.equal(slugify("Garg & Associates Pvt. Ltd."), "garg-and-associates");
  assert.equal(slugify("  ABC Infra LLP "), "abc-infra");
  assert.ok(slugify("x".repeat(80)).length <= 40);
});

test("first draft from the Vault", () => {
  const d = siteDefaults({ company: { legal_name: "Garg & Co", city: "Gurugram", state: "Haryana", phone: "9810012345", incorporation_date: "2014-04-01" }, services: ["GST returns", "Audit"] });
  assert.equal(d.slug, "garg-and-co");
  assert.match(d.tagline, /GST returns, Audit in Gurugram/);
  assert.match(d.about, /since 2014/);
  assert.equal(d.services.length, 2);
  assert.equal(d.address, "Gurugram, Haryana");
  assert.ok(d.seo_description.length <= 170);
});

test("schema.org data and phone links", () => {
  const j = jsonLd({ name: "X", phone: "981", city: "Pune", services: [{ title: "Audit" }] }, "https://d/s/x");
  assert.equal(j["@type"], "LocalBusiness");
  assert.equal(j.address.addressLocality, "Pune");
  assert.equal(j.makesOffer[0].itemOffered.name, "Audit");
  assert.equal(telHref("98100 12345"), "tel:+919810012345");
  assert.equal(telHref("12"), null);
});

test("AI text is checked", () => {
  assert.equal(cleanSiteText({ headline: "Hi", about: "short" }), null);
  const t = cleanSiteText({ headline: "Audit firm", about: "a".repeat(60), services: [{ title: "GST", text: "Returns" }, { text: "no title" }] });
  assert.equal(t.services.length, 1);
});
