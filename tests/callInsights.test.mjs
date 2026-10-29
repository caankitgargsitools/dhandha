import { test } from "node:test";
import assert from "node:assert/strict";
import { objectionsIn, moodOf, callInsights, objectionStats } from "../lib/callInsights.js";

const ai = (text) => ({ role: "ai", text });
const cl = (text) => ({ role: "client", text });

test("objections in English, Hinglish and Hindi", () => {
  const o = objectionsIn([ai("Namaste"), cl("Bahut mehenga hai, aur abhi nahi, baad mein call karo"), cl("Pehle se CA hai humare paas"), cl("डिटेल भेज दो")]);
  assert.deepEqual(o.map((x) => x.kind), ["price", "busy", "have_one", "send_details"]);
  assert.equal(o[0].turn, 1);
  assert.deepEqual(objectionsIn([cl("Who is this? How did you get my number")]).map((x) => x.kind), ["trust"]);
  assert.deepEqual(objectionsIn([ai("Is it too costly?")]), []); // only the client's words count
});

test("mood from words, outcome and who hung up", () => {
  assert.equal(moodOf([cl("Haan ji, theek hai, please send")], "interested"), "positive");
  assert.equal(moodOf([cl("Not interested, stop calling")], "not_interested", "client"), "negative");
  assert.equal(moodOf([cl("Hmm")], null), "neutral");
});

test("insights give a summary and the next step", () => {
  const i = callInsights({ transcript: [ai("Hello"), cl("I am busy, call later")], outcome: "call_back" });
  assert.equal(i.next, "Call back at the time they asked");
  assert.match(i.summary, /busy \/ call later/);
  assert.equal(callInsights({ transcript: [ai("Hello")] }).summary, "The client did not speak.");
});

test("objection stats across calls", () => {
  const s = objectionStats([
    { token: "a", outcome: "interested", transcript: [cl("too expensive")] },
    { token: "b", outcome: "not_interested", transcript: [cl("budget nahi hai")] },
    { token: "c", outcome: "call_back", transcript: [cl("in a meeting")] },
  ]);
  assert.equal(s[0].kind, "price");
  assert.equal(s[0].calls, 2);
  assert.equal(s[0].saved, 1);
  assert.deepEqual(s[0].example, { token: "a", turn: 0, text: "too expensive" });
});

test("lesson suggestions for objections that lose calls", async () => {
  const { lessonSuggestions } = await import("../lib/callInsights.js");
  const stats = [{ kind: "price", label: "Too costly", calls: 4, saved: 1 }, { kind: "busy", label: "Busy / call later", calls: 3, saved: 2 }, { kind: "trust", label: "Who are you? / spam", calls: 1, saved: 0 }];
  const s = lessonSuggestions(stats, []);
  assert.deepEqual(s.map((x) => x.kind), ["price"]);
  assert.match(s[0].situation, /too costly/);
  assert.deepEqual(lessonSuggestions(stats, [{ situation: "When the client says: too costly", status: "active" }]), []);
});
