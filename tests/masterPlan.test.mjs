import { test } from "node:test";
import assert from "node:assert/strict";
import { masterPlan, masterStatus, nextItem, progress } from "../lib/masterPlan.js";

test("what a CA firm selling to banks and GeM needs", () => {
  const items = masterPlan({ sectors: ["audit"], buyers: ["banks", "gem"], msme: true });
  const ids = items.map((i) => i.id);
  assert.ok(ids.includes("d:CERT-ICAI") && ids.includes("d:CERT-PEER"));
  assert.ok(ids.includes("q:cag_empanelled") && ids.includes("q:rbi_panel"));
  assert.ok(ids.includes("r:reg.gem_seller") && ids.includes("r:reg.bank_vendor"));
  assert.ok(ids.includes("b:brands"), "GeM buyers: brands & supplies");
  assert.ok(ids.includes("c:udyam_no") && ids.includes("d:REG-UDYAM"));
  assert.ok(!ids.includes("d:CERT-CONTR"), "not a works firm");
  assert.equal(new Set(ids).size, ids.length);
});

test("status from the Vault, and the next thing to ask", () => {
  const items = masterPlan({ sectors: ["manpower"], buyers: ["state"] });
  const st = masterStatus(items, {
    company: { legal_name: "ABC Services", pan: "AAAAA1111A" }, buyers: ["state"],
    docs: [{ type_code: "REG-PAN" }, { type_code: "CERT-LAB", valid_until: "2020-01-01" }],
    facts: [{ key: "fin.turnover", period: "FY 2024-25", value: "100" }, { key: "cred.psara", value: "yes" }], people: 2,
  });
  const by = Object.fromEntries(st.map((s) => [s.id, s]));
  assert.equal(by["buyers"].done, true);
  assert.equal(by["c:pan"].done, true);
  assert.equal(by["d:CERT-LAB"].done, false);
  assert.equal(by["d:CERT-LAB"].note, "expired 2020-01-01");
  assert.equal(by["f:turnover"].note, "1 of 3 years");
  assert.equal(by["q:psara"].done, true);
  assert.equal(nextItem(st).id, "c:constitution");
  const p = progress(st);
  assert.ok(p.done >= 6 && p.total > p.done);
});
