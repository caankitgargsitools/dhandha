import { test } from "node:test";
import assert from "node:assert/strict";
import { lineKey, lineStats, callFunnel, replayContext } from "../lib/callLearning.js";

const open = (co, name) => `Namaste ${name}, I am Dhandha AI, calling from ${co}. Is this a good time?`;
const calls = [
  { token: "a", config: { company: "GSC & Associates" }, contact: "Ravi", outcome: "interested", ended_by: "ai",
    transcript: [{ role: "ai", text: open("GSC & Associates", "Ravi") }, { role: "client", text: "Haan boliye" },
      { role: "ai", text: "We help businesses file GST on time. Would a 15-minute meeting help?" }, { role: "client", text: "Yes" },
      { role: "ai", text: "Thank you, the team will send a link on WhatsApp." }] },
  { token: "b", config: { company: "GSC & Associates" }, contact: "Meena", outcome: "not_interested", ended_by: "client",
    transcript: [{ role: "ai", text: open("GSC & Associates", "Meena") }, { role: "client", text: "Who is this?" },
      { role: "ai", text: "May I take 2 minutes of your time?", interrupted: true }] },
  { token: "c", config: { company: "GSC & Associates" }, contact: "Arjun", outcome: null, ended_by: "client",
    transcript: [{ role: "ai", text: open("GSC & Associates", "Arjun") }, { role: "client", text: "Busy" },
      { role: "ai", text: "May I take 5 minutes of your time?" }] },
];

test("same line to different clients is one line", () => {
  assert.equal(lineKey(open("GSC & Associates", "Ravi"), { company: "GSC & Associates", name: "Ravi" }),
    lineKey(open("GSC & Associates", "Meena"), { company: "GSC & Associates", name: "Meena" }));
  assert.equal(lineKey("Fee is ₹5,000 only!"), "fee is # only");
  assert.equal(lineKey("नमस्ते, मैं Dhandha AI हूँ"), "नमस्ते मैं dhandha ai हूँ");
});

test("line stats: liked, disliked and exit lines", () => {
  const s = lineStats(calls);
  const opening = s.lines.find((l) => l.key.startsWith("namaste {name}"));
  assert.equal(opening.said, 3); assert.equal(opening.replied, 3); assert.equal(opening.turn, 1); assert.equal(opening.few, true);
  const twoMin = s.lines.find((l) => l.key === "may i take # minutes of your time");
  assert.equal(twoMin.said, 2); assert.equal(twoMin.hungUp, 2); assert.equal(twoMin.interrupted, 1); assert.equal(twoMin.turn, 2);
  assert.deepEqual(twoMin.example, { token: "b", turn: 2 });
  assert.equal(s.exits[0].key, "may i take # minutes of your time");
  assert.equal(s.worst[0].key, "may i take # minutes of your time");
  assert.ok(s.best.some((l) => l.key.startsWith("we help businesses")));
});

test("funnel and replay context", () => {
  const f = callFunnel(calls);
  assert.deepEqual(f.reach, [3, 3, 1]);
  assert.equal(f.hungUp, 2); assert.equal(f.outcomes.interested, 1); assert.equal(f.outcomes["no result"], 1);
  const r = replayContext(calls[1].transcript, 2);
  assert.equal(r.heard, "Who is this?"); assert.equal(r.history.length, 1); assert.equal(r.original, "May I take 2 minutes of your time?");
  assert.equal(replayContext(calls[1].transcript, 1), null);
  assert.deepEqual(replayContext(calls[0].transcript, 0), { history: [], heard: "", original: calls[0].transcript[0].text });
});
