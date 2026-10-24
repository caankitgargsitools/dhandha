import { test } from "node:test";
import assert from "node:assert/strict";
import { profileHealth, fillReview, reviewUrl } from "../lib/gbp.js";

const NOW = Date.parse("2026-10-24T00:00:00Z");
test("a complete, well-reviewed profile scores 100", () => {
  const h = profileHealth({ businessStatus: "OPERATIONAL", userRatingCount: 40, rating: 4.7, reviews: [{ publishTime: "2026-10-10T00:00:00Z" }], websiteUri: "x", nationalPhoneNumber: "1", regularOpeningHours: {}, photos: Array(10).fill({}) }, NOW);
  assert.equal(h.score, 100);
  assert.ok(h.items.every((i) => i.ok));
});
test("a thin profile says what to fix", () => {
  const h = profileHealth({ userRatingCount: 4, rating: 4.0, reviews: [{ publishTime: "2026-05-01T00:00:00Z" }], photos: [{}] }, NOW);
  assert.ok(h.score < 40);
  const fix = Object.fromEntries(h.items.map((i) => [i.key, i.fix]));
  assert.match(fix.reviews, /21 to go/);
  assert.match(fix.rating, /Below 4.3/);
  assert.match(fix.fresh, /recent/);
  assert.match(fix.website, /website/);
  assert.equal(h.fresh, false);
});
test("review message and link", () => {
  assert.equal(fillReview("Hi {name}, {company}: {link}", { contact: "Ravi Kumar", company: "GSC", link: "L" }), "Hi Ravi, GSC: L");
  assert.equal(fillReview("Hi {name}", {}), "Hi there");
  assert.equal(reviewUrl("ChIJabc"), "https://search.google.com/local/writereview?placeid=ChIJabc");
});
