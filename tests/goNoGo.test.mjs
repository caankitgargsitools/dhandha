import test from "node:test";
import assert from "node:assert/strict";
import { goNoGo } from "../lib/goNoGo.js";

test("go / maybe / no", () => {
  assert.equal(goNoGo({ score: 85, daysLeft: 10 }).call, "go");
  assert.equal(goNoGo({ score: 85, unmet: 1, daysLeft: 10 }).call, "no");
  assert.equal(goNoGo({ score: 70, pending: 2, daysLeft: 10 }).call, "maybe");
  assert.equal(goNoGo({ score: 80, daysLeft: 1, readiness: 20 }).call, "no");
  assert.equal(goNoGo({ score: 80, daysLeft: -1 }).call, "closed");
  assert.match(goNoGo({ score: 70, emd: 100000, value: 1000000 }).why.join(), /EMD is high/);
});
