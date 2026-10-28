import { test } from "node:test";
import assert from "node:assert/strict";
import { normalisePlaybook, normaliseStep, splitDelay, delayMinutes, delayText, stepToForm, summary, STARTER } from "../lib/playbook.js";

test("delays: units in and out", () => {
  assert.equal(delayMinutes(2, "days"), 2880);
  assert.equal(delayMinutes(90, "minutes"), 90);
  assert.equal(delayMinutes(500, "days"), 90 * 1440); // capped at 90 days
  assert.deepEqual(splitDelay(2880), { amount: 2, unit: "days" });
  assert.deepEqual(splitDelay(120), { amount: 2, unit: "hours" });
  assert.deepEqual(splitDelay(45), { amount: 45, unit: "minutes" });
  assert.equal(delayText(0), "straight away");
  assert.equal(delayText(60), "after 1 hour");
});

test("steps are checked and shaped per type", () => {
  assert.match(normaliseStep({ type: "ai_call", script: "hi" }, 0).error, /script/);
  const call = normaliseStep({ type: "ai_call", script: "Namaste {name}, calling from {our_company}", language: "hi", voice: "male", match_language: false, amount: 5, unit: "minutes" }, 0).row;
  assert.equal(call.channel, "ai_call");
  assert.equal(call.delay_minutes, 5);
  assert.deepEqual(call.config, { script: "Namaste {name}, calling from {our_company}", goal: "", language: "hi", voice: "male", match_language: false });
  assert.match(normaliseStep({ type: "whatsapp", wa_template: "Bad Name" }, 1).error, /template/);
  assert.equal(normaliseStep({ type: "whatsapp", wa_template: "intro_v2" }, 1).row.wa_template, "intro_v2");
  assert.match(normaliseStep({ type: "email", subject: "Hi" }, 2).error, /subject and message/);
  const link = normaliseStep({ type: "booking_link", send_via: "email" }, 3).row;
  assert.deepEqual(link.config, { send_via: "email", type_id: null });
  assert.match(normaliseStep({ type: "booking_link", send_via: "whatsapp" }, 3).error, /\{\{3\}\}/);
  assert.equal(normaliseStep({ type: "task", title: "Call back" }, 4).row.config.title, "Call back");
  assert.match(normaliseStep({ type: "sms" }, 0).error, /choose/);
});

test("a playbook in any order, numbered as given", () => {
  const r = normalisePlaybook({ name: "Email first", trigger: "new_lead", trigger_sources: ["google_maps", "", "google_maps"], office_from: "09:30", office_to: "18:00", office_days: [6, 1, 2, 9],
    steps: [{ type: "email", subject: "Hello", body: "Dear {name}" }, { type: "ai_call", script: "Calling about your email", amount: 1, unit: "days" }, { type: "whatsapp", wa_template: "follow_up" }] });
  assert.equal(r.error, undefined);
  assert.deepEqual(r.steps.map((s) => [s.step_no, s.channel]), [[1, "email"], [2, "ai_call"], [3, "whatsapp"]]);
  assert.deepEqual(r.playbook.office_days, [1, 2, 6]);
  assert.deepEqual(r.playbook.trigger_sources, ["google_maps"]);
  assert.equal(r.playbook.trigger, "new_lead");
  assert.match(normalisePlaybook({ name: "x", steps: [] }).error, /name/);
  assert.match(normalisePlaybook({ name: "Ok", steps: [] }).error, /at least one step/);
  assert.match(normalisePlaybook({ name: "Ok", office_days: [1], office_from: "19:00", office_to: "10:00", steps: [{ type: "task", title: "Call" }] }).error, /closing time/);
});

test("saved rows round-trip to the form; the starter is valid", () => {
  const { steps } = normalisePlaybook({ ...STARTER, steps: STARTER.steps.map((s) => (s.type === "whatsapp" ? { ...s, wa_template: "hello_intro" } : s)) });
  assert.equal(steps.length, 5);
  const back = stepToForm(steps[1]);
  assert.equal(back.type, "whatsapp");
  assert.deepEqual([back.amount, back.unit], [1, "hours"]);
  assert.equal(summary(steps), "🤖 AI call → 💬 WhatsApp → ✉️ Email → 📅 Booking link → 📝 Task for a person");
  // an older sequence step (day_offset, no delay_minutes) reads as days
  assert.deepEqual([stepToForm({ channel: "email", day_offset: 3 }).amount, stepToForm({ channel: "email", day_offset: 3 }).unit], [3, "days"]);
});
