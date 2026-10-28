// Google Business Profile replies and posts (PENDING 42; pure, tested). Reviews come from Place Details (public);
// a reply is drafted free from a template, or written by AI (free tier first — reviews are public text). Dhandha
// cannot post on Google for the business (that needs Google's Business Profile API approval), so the person copies the
// draft and replies in Google's own app.

const first = (name) => String(name || "").trim().split(/\s+/)[0] || "";
const textOf = (r) => r?.text?.text || r?.originalText?.text || "";

export function reviewList(details = {}) {
  return (details?.reviews || []).map((r, i) => ({
    i, author: r.authorAttribution?.displayName || "A customer", rating: Number(r.rating) || 0, text: textOf(r),
    when: r.relativePublishTimeDescription || "", publishTime: r.publishTime || null,
  }));
}

// free: a warm, specific-enough reply by rating — the person edits it before posting
export function templateReply(review, business = "our team") {
  const n = first(review?.author);
  const hi = n ? `Dear ${n}, ` : "";
  const r = Number(review?.rating) || 0;
  if (r >= 4) return `${hi}thank you so much for the ${r}-star review! We are glad you had a good experience with ${business}, and we look forward to working with you again.`;
  if (r === 3) return `${hi}thank you for your feedback. We are always trying to do better — please tell us what we could have done differently, and we will make it right. You can reach us directly at the number on this profile.`;
  return `${hi}we are sorry your experience with ${business} fell short. This is not the standard we aim for. Please call us at the number on this profile so we can understand what happened and set it right.`;
}

export const TONES = { warm: "warm and grateful", formal: "formal and professional", short: "very short (one or two sentences)" };

export function replyPrompt({ review, business, tone = "warm", lang }) {
  return `You reply to Google reviews for an Indian business called "${business}".
Write ONE reply to this review, ${TONES[tone] || TONES.warm}. Under 80 words. Thank them by first name if given.
If the review is negative (1-3 stars): apologise without arguing, do not admit legal fault, invite them to call the business, no discounts or offers.
Never ask for a better rating. Never invent facts about the customer's job. Write in ${lang || "the same language as the review (English if empty)"}.
Review by ${review.author}, ${review.rating} stars: """${String(review.text || "(no text, rating only)").slice(0, 1500)}"""
Answer as JSON: {"reply": "..."}`;
}

export function postPrompt({ business, category, topic, kind = "update" }) {
  return `Write a Google Business Profile post for "${business}"${category ? ` (${category})` : ""}, an Indian business.
Kind: ${kind === "offer" ? "an offer" : kind === "event" ? "an event" : "a news update"}. Topic from the owner: """${String(topic || "").slice(0, 500)}"""
Rules: 60-120 words, plain friendly English, one clear call to action (call us / visit / book), no hashtags, no emojis in the first line,
no phone numbers or links (Google adds the button), no claims you cannot know (prices, awards) unless the topic says so.
Answer as JSON: {"post": "...", "button": "CALL" | "BOOK" | "LEARN_MORE"}`;
}

export const cleanReply = (d) => (typeof d?.reply === "string" && d.reply.trim().length >= 10 ? d.reply.trim().slice(0, 1000) : null);
export const cleanPost = (d) => (typeof d?.post === "string" && d.post.trim().length >= 30 ? { post: d.post.trim().slice(0, 1500), button: ["CALL", "BOOK", "LEARN_MORE"].includes(d.button) ? d.button : "CALL" } : null);
