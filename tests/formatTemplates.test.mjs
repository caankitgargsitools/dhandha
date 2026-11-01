import { test } from "node:test";
import assert from "node:assert/strict";
import { dataFor, renderTemplate, matchTemplates, headingOnly, templateById } from "../lib/formatTemplates.js";
import { TEMPLATES } from "../lib/formatCatalog.js";
import { candidates, choiceLabel } from "../lib/formatLibrary.js";

const company = { legal_name: "Sharma & Associates", constitution: "partnership", pan: "AAKFS1234K", gstin: "06AAKFS1234K1Z5", registered_address: "SCO 42, Sector 14", city: "Gurugram", state: "Haryana", pincode: "122001", signatory_name: "CA Rohit Sharma", signatory_designation: "Managing Partner", msme_category: "micro", udyam_no: "UDYAM-HR-05-0012345" };
const data = dataFor({ company, facts: [{ key: "fin.turnover", period: "FY 2024-25", value: "42500000" }, { key: "fin.turnover", period: "FY 2023-24", value: "36800000" }, { key: "fin.net_worth", period: "FY 2024-25", value: "18500000" }],
  people: [{ name: "CA Rohit Sharma", designation: "Managing Partner", pan: "AAAPS1234A" }, { name: "CA Amit", designation: "Audit Manager" }], works: [{ work_name: "Branch audit", client: "PNB", value_inr: 3200000, end_date: "2025-03-31", status: "completed" }],
  tender: { title: "Statutory audit of MGNREGS", tender_ref: "2026_MPSEG_545122_1", authority: "Commissioner, MPSREGC", emd_inr: 25000 }, today: new Date("2026-11-01") });

test("every template has the fields the picker needs and renders", () => {
  const ids = new Set();
  for (const t of TEMPLATES) {
    assert.ok(t.id && t.type && t.label && t.when && t.re instanceof RegExp && t.body, t.id);
    assert.ok(!ids.has(t.id), `duplicate ${t.id}`); ids.add(t.id);
    const out = renderTemplate(t, data);
    assert.ok(!/\{[a-z_:]+\}/.test(out), `${t.id} left a placeholder: ${out.match(/\{[a-z_:]+\}/)}`);
  }
  assert.ok(TEMPLATES.length >= 25);
});

test("values come from the Vault; missing ones become yellow boxes", () => {
  const out = renderTemplate(templateById("bidder_info_table"), data);
  assert.match(out, /Name of the bidder: Sharma & Associates/);
  assert.match(out, /Constitution: Partnership firm/);
  assert.match(out, /\[TO BE FILLED: CIN \/ registration no\.\]/);
  assert.match(out, /⟦table Name\|Designation\|PAN/);
  const t = renderTemplate(templateById("turnover_statement"), data);
  assert.match(t, /FY 2024-25\|4,25,00,000/);
  assert.match(t, /Average annual turnover: Rs\. 3,96,50,000/);
});

test("a heading alone gets the standard versions, the firm's constitution first", () => {
  assert.equal(headingOnly(""), true);
  const poa = matchTemplates("Annexure 7: Format for Power of Attorney for Authorised Signatory", "", { constitution: "partnership" }).map((t) => t.id);
  assert.equal(poa[0], "poa_partnership");
  assert.ok(poa.includes("poa_general"));
  const company2 = matchTemplates("Board Resolution", "", { constitution: "private_limited" }).map((t) => t.id);
  assert.equal(company2[0], "poa_company");
  const c = candidates("Annexure 5: Blacklisting and pending suit declaration", "");
  assert.equal(c[0], "tpl:non_blacklisting_letter");
  assert.ok(c.includes("non_blacklisting") && c.includes("custom") && c.at(-1) === "manual");
  assert.match(choiceLabel("custom", ""), /from the heading/);
  assert.match(choiceLabel("tpl:non_blacklisting_affidavit"), /stamp paper/);
});

test("a format with its own text keeps the tender's wording ahead of the standard versions", () => {
  const c = candidates("Annexure 4: Self-declaration", "I/We hereby declare that ".repeat(20));
  assert.ok(c.indexOf("custom") < c.indexOf("tpl:self_declaration_general"));
  assert.deepEqual(candidates("Financial bid / BOQ", ""), ["price", "manual"]);
});

test("the wider catalogue: specialist formats, how they are executed, answers reused", async () => {
  const { templateHint } = await import("../lib/formatTemplates.js");
  assert.ok(TEMPLATES.length >= 60, String(TEMPLATES.length));
  assert.equal(matchTemplates("Form G: Affidavit for non-execution of similar works through another contractor on back to back basis")[0].id, "back_to_back_affidavit");
  assert.ok(matchTemplates("Proforma of Bank Guarantee for EMD").some((t) => t.id === "emd_bank_guarantee"));
  assert.equal(matchTemplates("Manufacturer's Authorization Form")[0].id, "manufacturer_authorisation");
  assert.equal(matchTemplates("Declaration of Fidelity and Secrecy")[0].id, "fidelity_secrecy");
  assert.match(templateHint(templateById("emd_bank_guarantee")), /your bank issues it/);
  assert.ok(candidates("Annexure 9: Format of Performance Bank Guarantee", "").includes("tpl:performance_bank_guarantee"));
  assert.ok(candidates("Annexure 2: Power of Attorney", "").length <= 8);
  // an FRN typed once in one format fills every later format that needs it
  const d = dataFor({ company, facts: [{ key: "master.frn_of_the_firm", value: "012345N" }, { key: "master.frn_of_the_ca_firm", value: "099999C" }] });
  assert.match(renderTemplate(templateById("firm_constitution_ca"), d), /FRN\): 012345N/);
  assert.match(renderTemplate(templateById("turnover_ca_certificate"), d), /FRN: 099999C/);
  assert.match(renderTemplate(templateById("cover_letter"), dataFor({ company, tender: { bid_validity_days: 120 } })), /valid for 120 days/);
});
