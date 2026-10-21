import { test } from "node:test";
import assert from "node:assert/strict";
import { waitForAnswer } from "../src/captcha.js";

const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "pk", INGEST_KEY: "k", CAPTCHA_WAIT_MIN: "1" };
const fake = (polls) => {
  const calls = [];
  const fetchFn = async (url, init) => {
    const fn = url.split("/").pop(); calls.push([fn, JSON.parse(init.body)]);
    const body = fn === "captcha_ask" ? "id-1" : polls.shift();
    return { ok: true, json: async () => body };
  };
  return { calls, fetchFn };
};

test("waits until a person types the answer", async () => {
  const { calls, fetchFn } = fake([{ status: "waiting" }, { status: "answered", answer: "x7k2" }]);
  const a = await waitForAnswer(env, { runner: "gh", portal: "CPPP", purpose: "results", image: "data:image/png;base64,AA", fetchFn, pause: async () => {}, log: () => {} });
  assert.equal(a, "x7k2");
  assert.equal(calls[0][0], "captcha_ask");
  assert.equal(calls[0][1].p_key, "k");
  assert.equal(calls.filter((c) => c[0] === "captcha_poll").length, 2);
});

test("skipped or expired gives up", async () => {
  const { fetchFn } = fake([{ status: "skipped" }]);
  assert.equal(await waitForAnswer(env, { image: "data:image/png;base64,AA", fetchFn, pause: async () => {}, log: () => {} }), null);
});

test("switched off asks nobody", async () => {
  const { calls, fetchFn } = fake([]);
  assert.equal(await waitForAnswer({ ...env, CAPTCHA_WAIT_MIN: "0" }, { fetchFn, log: () => {} }), null);
  assert.equal(calls.length, 0);
});
