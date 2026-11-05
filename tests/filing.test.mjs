import test from "node:test";
import assert from "node:assert/strict";
import { filingKit, emdOnFiling } from "../lib/filing.js";

const now = new Date("2026-11-05T00:00:00Z");
const docs = [
  { id: 1, type_code: "REG-PAN", title: "PAN" },
  { id: 2, type_code: "REG-GST", valid_until: "2026-11-10" },
  { id: 3, type_code: "DSC", valid_until: "2026-11-15" },
  { id: 4, type_code: "CERT-ISO", valid_until: "2026-10-01" },
];

test("filing kit marks missing, expired, expiring and the DSC", () => {
  const k = filingKit({ required: ["REG-PAN", "REG-GST", "FIN-AUDIT", "CERT-ISO", "DSC"], docs, dueAt: "2026-11-20T10:00:00Z", packs: [{ kind: "draft" }], ticks: { "doc:REG-PAN": "x" }, now });
  const by = Object.fromEntries(k.slots.map((s) => [s.key, s.state]));
  assert.equal(by.pack, "draft");
  assert.equal(by["doc:REG-PAN"], "ready");
  assert.equal(by["doc:REG-GST"], "expires_before_close");
  assert.equal(by["doc:FIN-AUDIT"], "missing");
  assert.equal(by["doc:CERT-ISO"], "expired");
  assert.equal(k.dsc.state, "expires_before_close");
  assert.ok(!k.slots.some((s) => s.code === "DSC"));
  assert.equal(k.ticked, 1);
  assert.equal(k.ready, false);
});

test("EMD on filing: held, or exempt for an MSE when allowed", () => {
  assert.deepEqual(emdOnFiling({ emd: 25000, mode: "bg", reference: "BG1" }), { kind: "emd", amount: 25000, mode: "bg", status: "held", reference: "BG1" });
  assert.equal(emdOnFiling({ emd: 25000, msme: true, mseExempt: true }).status, "exempt");
  assert.equal(emdOnFiling({ emd: 0 }), null);
});
