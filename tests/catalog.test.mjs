import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, searchCatalog, rulesFor, ruleHits, TAXONOMY } from "../lib/taxonomy.js";

const rows = [
  { id: "i1", kind: "industry", label: "Drone services", status: "pending", mine: true },
  { id: "s1", kind: "sub", parent: "x.i1", label: "Aerial work", status: "pending", mine: true },
  { id: "v1", kind: "service", parent: "x.s1", label: "Drone spraying", keywords: ["drone spraying", "agri drone"], status: "pending", mine: true },
  { id: "v2", kind: "service", parent: "pro.tax", label: "Trust audits", keywords: ["!trust audit", "audit of trust"], status: "approved" },
  { id: "v3", kind: "service", parent: "pro.tax", label: "Rejected one", keywords: ["x"], status: "rejected" },
];

test("custom industries, sub-industries and services join the catalogue", () => {
  const { tree, index } = buildCatalog(rows);
  assert.equal(tree.length, TAXONOMY.length + 1);
  assert.equal(index["x.v1"].industry, "Drone services");
  assert.equal(index["x.v2"].pack, "ca_audit"); // takes the built-in industry's pack
  assert.equal(index["x.v3"], undefined); // rejected, not ours
  assert.equal(TAXONOMY.find((i) => i.id === "pro").subs.find((s) => s.id === "pro.tax").services.some((v) => v.id === "x.v2"), false); // built-in list untouched
});

test("search finds industries first, then services by label or keyword", () => {
  const { tree } = buildCatalog(rows);
  const r = searchCatalog(tree, "audit");
  assert.equal(r[0].type, "industry"); // "Professional services (CA, audit, consulting)"
  assert.ok(r.some((x) => x.service?.id === "x.v2"));
  assert.ok(searchCatalog(tree, "agri drone").some((x) => x.service?.id === "x.v1"));
  assert.deepEqual(searchCatalog(tree, "a"), []);
});

test("rules use the catalogue's custom services", () => {
  const { index } = buildCatalog(rows);
  const rules = rulesFor(["x.v2", "x.v1"], [], [], index);
  assert.ok(rules.some((r) => r.k === "trust audit" && r.strong));
  assert.ok(rules.find((r) => r.k === "trust audit") && ruleHits(rules.find((r) => r.k === "trust audit"), "Appointment of firm for trust audit of temples"));
});
