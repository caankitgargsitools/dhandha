import { test } from "node:test";
import assert from "node:assert/strict";
import { sendTenders } from "../src/ingest.js";

test("a timed-out batch is retried in halves; others still go through", async () => {
  const rows = Array.from({ length: 450 }, (_, i) => ({ tender_ref: String(i) }));
  let calls = 0;
  const post = async (src, batch) => {
    calls++;
    if (batch.length === 200 && batch[0].tender_ref === "200") throw new Error('ingest 500: {"code":"57014"}');
    return { received: batch.length, inserted: batch.length };
  };
  const t = await sendTenders("x", rows, {}, { post, pause: 0 });
  assert.equal(t.received, 450);
  assert.equal(t.failed, undefined);
  assert.equal(calls, 5); // 200, 200 (fails) → 100 + 100, 50
});

test("other errors are not retried; all failing throws", async () => {
  const post = async () => { throw new Error("ingest 401: bad key"); };
  await assert.rejects(sendTenders("x", [{ tender_ref: "1" }], {}, { post, pause: 0 }), /401/);
});
