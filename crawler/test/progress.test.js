import test from "node:test";
import assert from "node:assert/strict";
import { pool, rotate, createProgress } from "../src/progress.js";

test("rotate and pool", async () => {
  assert.deepEqual(rotate([1, 2, 3, 4], 5), [2, 3, 4, 1]);
  assert.deepEqual(rotate([], 3), []);
  let running = 0, peak = 0;
  const done = [];
  await pool([1, 2, 3, 4, 5], 2, async (x) => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); done.push(x); running--; });
  assert.equal(peak, 2);
  assert.deepEqual(done.sort(), [1, 2, 3, 4, 5]);
});

test("progress posts state and step timings", async () => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push(JSON.parse(init.body)); return { ok: true }; };
  try {
    const p = createProgress({ SUPABASE_URL: "https://x", SUPABASE_PUBLISHABLE_KEY: "k", INGEST_KEY: "dhk_1", RUNNER_NAME: "gh" }, ["A · tenders", "B · tenders"]);
    await p.start();
    await p.begin("A · tenders");
    await p.end("A · tenders", { items: 12, note: "12 received" });
    p.skip("B · tenders", "time budget used up");
    await p.finish(true);
    const last = calls.at(-1);
    assert.equal(last.p_status, "finished");
    assert.equal(last.p_runner, "gh");
    assert.deepEqual(last.p_state.steps.map((s) => s.status), ["done", "skipped"]);
    const ended = calls.find((c) => c.p_done);
    assert.equal(ended.p_done.step, "A · tenders");
    assert.equal(ended.p_done.items, 12);
  } finally {
    globalThis.fetch = orig;
  }
});
