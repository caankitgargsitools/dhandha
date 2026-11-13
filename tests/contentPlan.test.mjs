import test from "node:test";
import assert from "node:assert/strict";
import { planMonth, templatePost, cleanAiPost, shareLink, tooLong, monthGrid, aiPostPrompt } from "../lib/contentPlan.js";

test("plan a month: Mon/Wed/Fri plus occasions, channels rotate, taken days skipped", () => {
  const p = planMonth({ year: 2027, month: 1, perWeek: 3, channels: ["google", "linkedin"], taken: ["2027-01-04"] });
  assert.ok(p.find((x) => x.post_on === "2027-01-26" && x.theme === "occasion" && x.occasion === "Republic Day"));
  assert.ok(!p.find((x) => x.post_on === "2027-01-04"));
  assert.equal(p[0].channel, "google");
  assert.equal(p[1].channel, "linkedin");
  const wd = p.filter((x) => !x.occasion).map((x) => new Date(x.post_on).getUTCDay());
  assert.ok(wd.every((d) => [1, 3, 5].includes(d)));
  assert.ok(planMonth({ year: 2027, month: 1, hasWorks: false }).every((x) => x.theme !== "work"));
  assert.ok(planMonth({ year: 2027, month: 1, from: "2027-01-20" }).every((x) => x.post_on >= "2027-01-20"));
});

test("templates, AI clean-up, share links, length", () => {
  const t = templatePost({ theme: "work", business: "Garg & Co", city: "Gurugram", work: { work_name: "Audit of DFO Nuh", client: "Forest Dept" }, voice: { hashtags: "audit, CA" } });
  assert.match(t.body, /Audit of DFO Nuh for Forest Dept/);
  assert.equal(t.hashtags, "#audit #CA #GargCo #Gurugram");
  assert.equal(cleanAiPost({ body: "short" }), null);
  const c = cleanAiPost({ title: "T", body: "x".repeat(400), hashtags: "#a #b junk #c" }, "x");
  assert.equal(c.body.length, 280);
  assert.equal(c.hashtags, "#a #b #c");
  assert.match(shareLink({ channel: "whatsapp", body: "Hi there" }), /^https:\/\/wa\.me\/\?text=Hi%20there/);
  assert.equal(shareLink({ channel: "google", body: "x" }), null);
  assert.equal(tooLong({ channel: "x", body: "y".repeat(300) }), 20);
  assert.match(aiPostPrompt({ theme: "tip", business: "A", voice: { avoid_words: "cheap" } }), /Never use: cheap/);
});

test("month grid starts on Monday", () => {
  const g = monthGrid(2026, 11, [{ post_on: "2026-11-02", id: 1 }]);
  assert.equal(g[0].filter((c) => c === null).length, 6); // 1 Nov 2026 is a Sunday
  assert.equal(g[1][0].posts.length, 1);
});
