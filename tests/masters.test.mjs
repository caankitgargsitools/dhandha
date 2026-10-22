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
