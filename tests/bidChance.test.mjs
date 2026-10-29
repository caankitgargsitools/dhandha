import { test } from "node:test";
import assert from "node:assert/strict";
import { bidChance } from "../lib/bidChance.js";

const r = (status, authority, state, estimate = 5e6) => ({ status, authority, state, industry_pack: "construction", estimate });

test("records per department and state", () => {
  const c = bidChance([r("won", "PWD", "Haryana"), r("lost", "PWD", "Haryana"), r("lost", "NHAI", "Delhi"), r("submitted", "PWD", "Haryana")], { authority: "PWD", state: "Haryana", industry_pack: "construction", value_inr: 4e6 });
  assert.equal(c.decided, 3);
  assert.equal(c.p, null); // too few decided bids for a number
  assert.deepEqual(c.records.find((x) => x.key === "authority"), { key: "authority", label: "this department", value: "PWD", bids: 2, won: 1 });
  assert.equal(c.records.find((x) => x.key === "band").bids, 3);
});

test("estimate once enough bids are decided", () => {
  const rows = [...Array(4)].map(() => r("won", "PWD", "Haryana")).concat([...Array(6)].map(() => r("lost", "NHAI", "Delhi")));
  const good = bidChance(rows, { authority: "PWD", state: "Haryana" });
  const bad = bidChance(rows, { authority: "NHAI", state: "Delhi" });
  assert.ok(good.p > 70, String(good.p));
  assert.ok(bad.p < 15, String(bad.p));
});
