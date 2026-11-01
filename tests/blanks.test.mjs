import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseBlanks, aliasValue, fillPlaceholders, classifyBlanks, PER_TENDER, matchFact } from "../lib/masters.js";
import { candidates } from "../lib/formatLibrary.js";

test("the tender's own blanks become questions with labels", () => {
  assert.equal(normaliseBlanks("Name of the Bidder: __________\nPAN No. ..........\nDate: [___2581___]"),
    "Name of the Bidder: [TO BE FILLED: Name of the Bidder]\nPAN No. [TO BE FILLED: PAN No.]\nDate: [TO BE FILLED: Date]");
  assert.equal(normaliseBlanks("⟦table A|B⟧\n____|x\n⟦/table⟧"), "⟦table A|B⟧\n____|x\n⟦/table⟧");
});

test("blanks the company record and the tender answer are filled", () => {
  const ctx = { company: { legal_name: "Sharma & Associates", gstin: "06AAKFS1234K1Z5", pan: "AAKFS1234K", bank_account: "30000000001", bank_ifsc: "SBIN0001234", signatory_name: "CA Rohit Sharma", constitution: "partnership" }, tender: { tender_ref: "T-55", title: "Statutory audit" } };
  assert.equal(aliasValue("GSTIN", ctx), "06AAKFS1234K1Z5");
  assert.equal(aliasValue("Bank Account No.", ctx), "30000000001");
  assert.equal(aliasValue("Name of the authorised signatory", ctx), "CA Rohit Sharma");
  assert.equal(aliasValue("Tender No.", ctx), "T-55");
  assert.equal(aliasValue("Constitution of the firm", ctx), "Partnership firm");
  assert.equal(aliasValue("Favourite colour", ctx), null);
  const out = fillPlaceholders("Bidder: ______\nIFSC: [TO BE FILLED: IFSC]\nSignature of bidder: [TO BE FILLED: Signature of the bidder]", [], ctx);
  assert.equal(out, "Bidder: Sharma & Associates\nIFSC: SBIN0001234\nSignature of bidder: ");
});

test("signatures are never questions; firm details never stick to a partner", () => {
  const b = classifyBlanks("[TO BE FILLED: Name of Partner 1] [TO BE FILLED: Years in business of the firm] [TO BE FILLED: Seal of the firm]");
  assert.deepEqual(b.map((x) => x.type), ["partner", "fact", "junk"]);
});

test("another tender's date or number is never reused", () => {
  assert.ok(PER_TENDER.test("Tender No."));
  assert.ok(PER_TENDER.test("Quoted fee in figures"));
  assert.equal(matchFact("Tender No.", [{ key: "master.tender_no", value: "OLD/123" }]), null);
});

test("contract forms and guarantees are not part of the bid by default", () => {
  assert.equal(candidates("Annexure 20: Draft Contract / Agreement", "")[0], "reference");
  assert.equal(candidates("Format of Performance Bank Guarantee", "")[0], "reference");
  assert.deepEqual(candidates("Annexure 14: Financial Proposal Format", ""), ["price", "manual"]);
  assert.deepEqual(candidates("Form FIN-2: Summary of costs", ""), ["price", "manual"]);
});
