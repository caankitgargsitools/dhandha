import { test } from "node:test";
import assert from "node:assert/strict";
import { oemsFrom, suppliesFrom, oemCheck, slugKey } from "../lib/oem.js";

const facts = [
  { key: "oem.hp", value: JSON.stringify({ brand: "HP", products: "laptops, desktop computers, printers", auth_no: "HP/2026/77" }), valid_until: "2027-03-31" },
  { key: "supply.desktop_computers", period: "FY 2024-25", value: JSON.stringify({ product: "Desktop computers", qty: 600, unit: "nos" }) },
  { key: "supply.desktop_computers", period: "FY 2023-24", value: JSON.stringify({ product: "Desktop computers", qty: 900, unit: "nos" }) },
  { key: "supply.printers", period: "FY 2024-25", value: JSON.stringify({ product: "Printers", qty: 50 }) },
  { key: "fin.turnover", period: "FY 2024-25", value: "1" },
];

test("brands and supplies from the Vault's facts", () => {
  assert.equal(oemsFrom(facts).length, 1);
  assert.equal(suppliesFrom(facts).length, 3);
  assert.equal(slugKey("Desktop Computers (i5)"), "desktop_computers_i5");
});

test("OEM authorisation and past performance against a GeM bid", () => {
  const gem = { documents_required: "Experience Criteria,Past Performance,OEM Authorization Certificate", past_performance_pct: 80, total_qty: 1000 };
  const rows = Object.fromEntries(oemCheck({ gem, title: "Desktop Computers (Q2)", oems: oemsFrom(facts), supplies: suppliesFrom(facts), dueAt: "2026-11-20" }).map((r) => [r.key, r]));
  assert.equal(rows.oem.state, "ok");
  assert.match(rows.oem.have, /HP · HP\/2026\/77/);
  assert.equal(rows.past.state, "ok"); // 900 ≥ 800
  const late = oemCheck({ gem, title: "Desktop Computers", oems: oemsFrom(facts), supplies: suppliesFrom(facts), dueAt: "2027-06-01" });
  assert.equal(late[0].state, "bad");
  const other = Object.fromEntries(oemCheck({ gem: { ...gem, total_qty: 2000 }, title: "Desktop Computers", oems: [], supplies: suppliesFrom(facts) }).map((r) => [r.key, r]));
  assert.equal(other.oem.state, "ask");
  assert.equal(other.past.state, "bad");
  assert.match(other.past.note, /Short by 700/);
  assert.deepEqual(oemCheck({ gem: null }), []);
  assert.equal(oemCheck({ gem, title: "Office chairs", oems: oemsFrom(facts), supplies: suppliesFrom(facts) }).find((r) => r.key === "past").state, "ask");
});
