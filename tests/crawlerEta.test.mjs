import test from "node:test";
import assert from "node:assert/strict";
import { expectedSeconds, fraction, remaining, queueEta, dur } from "../lib/crawlerEta.js";

test("estimates from history or defaults", () => {
  assert.equal(expectedSeconds("Haryana e-Procurement · tenders", { "Haryana e-Procurement · tenders": { avg_seconds: "200.0" } }), 200);
  assert.equal(expectedSeconds("X · winners", {}), 120);
  assert.equal(expectedSeconds("X · tenders", {}), 150);
});

test("progress fraction and time left", () => {
  assert.equal(fraction({ phase: "listing", page: 3, of: 5 }, 10, 100), 0.3 * (2 / 5));
  assert.ok(Math.abs(fraction({ phase: "details", done: 25, total: 50 }, 60, 100) - 0.65) < 1e-9);
  assert.equal(remaining({ phase: "details", done: 25, total: 50 }, 65, 150), 35); // 65 / 0.65 - 65
  assert.equal(remaining({ phase: "listing", page: 1, of: 5 }, 10, 150), 140);
});

test("queue start times with parallel lanes", () => {
  const q = queueEta([{ left: 30 }, { left: 90 }], [{ step: "A · tenders" }, { step: "B · winners" }, { step: "C · tenders" }], {}, 2);
  assert.deepEqual(q.map((x) => x.startsIn), [30, 90, 180]);
  assert.equal(dur(59), "59s");
  assert.equal(dur(125), "2m 05s");
  assert.equal(dur(3725), "1h 2m");
});
