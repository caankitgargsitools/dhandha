import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewList, templateReply, replyPrompt, postPrompt, cleanReply, cleanPost } from "../lib/reviewReply.js";

test("reviews from Place Details", () => {
  const list = reviewList({ reviews: [{ rating: 5, text: { text: "Great work" }, authorAttribution: { displayName: "Ravi Kumar" }, relativePublishTimeDescription: "a week ago" }] });
  assert.deepEqual(list[0], { i: 0, author: "Ravi Kumar", rating: 5, text: "Great work", when: "a week ago", publishTime: null });
  assert.deepEqual(reviewList(null), []);
});

test("free template replies by rating", () => {
  assert.match(templateReply({ author: "Ravi Kumar", rating: 5 }, "Garg & Co"), /^Dear Ravi, thank you so much for the 5-star review.*Garg & Co/);
  assert.match(templateReply({ author: "", rating: 3 }), /^thank you for your feedback/);
  assert.match(templateReply({ author: "Anu", rating: 1 }, "X"), /sorry/);
});

test("prompts and answers", () => {
  const p = replyPrompt({ review: { author: "Anu", rating: 2, text: "Late delivery" }, business: "X", tone: "short" });
  assert.match(p, /very short/);
  assert.match(p, /Late delivery/);
  assert.match(postPrompt({ business: "X", topic: "Diwali GST camp", kind: "event" }), /an event/);
  assert.equal(cleanReply({ reply: "  Thank you, Anu!  " }), "Thank you, Anu!");
  assert.equal(cleanReply({ reply: "ok" }), null);
  assert.deepEqual(cleanPost({ post: "x".repeat(40), button: "NOPE" }), { post: "x".repeat(40), button: "CALL" });
});
