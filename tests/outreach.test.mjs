import test from "node:test";
import assert from "node:assert/strict";
import { emailHtml, emailText, whatsappPayload, inboxPayload, windowLeft } from "../lib/outreach.js";

test("email html escapes the body and carries an unsubscribe link", () => {
  const h = emailHtml({ body: "Dear Vikas,\n\nWe <b>help</b> firms & builders.\nCall us.", company: "Garg & Co", address: "Gurugram", unsubUrl: "https://x.in/u/abc" });
  assert.match(h, /<p style="margin:0 0 14px">Dear Vikas,<\/p>/);
  assert.match(h, /We &lt;b&gt;help&lt;\/b&gt; firms &amp; builders\.<br>Call us\./);
  assert.match(h, /Garg &amp; Co, Gurugram/);
  assert.match(h, /href="https:\/\/x\.in\/u\/abc"/);
  assert.match(emailText({ body: "Hi", company: "Garg & Co", unsubUrl: "u" }), /Hi\n\n--\nGarg & Co\nUnsubscribe: u/);
});

test("WhatsApp template payload", () => {
  assert.deepEqual(whatsappPayload({ to: "9810012345", template: "intro_offer", lang: "en", params: ["Vikas", "Garg & Co"] }), {
    messaging_product: "whatsapp", to: "919810012345", type: "template",
    template: { name: "intro_offer", language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: "Vikas" }, { type: "text", text: "Garg & Co" }] }] },
  });
  assert.deepEqual(whatsappPayload({ to: "9810012345", template: "hello", params: [] }).template.components, []);
});

test("inbox replies: free text, or a template with first name and company", () => {
  assert.deepEqual(inboxPayload({ kind: "text", to: "9876543210", body: "Hello" }),
    { messaging_product: "whatsapp", to: "919876543210", type: "text", text: { body: "Hello", preview_url: true } });
  const t = inboxPayload({ kind: "template", to: "9876543210", template: "follow_up|hi", name: "Ravi Kumar", company: "GSC" });
  assert.equal(t.type, "template"); assert.equal(t.template.name, "follow_up"); assert.equal(t.template.language.code, "hi");
  assert.deepEqual(t.template.components[0].parameters.map((p) => p.text), ["Ravi", "GSC"]);
  const now = Date.parse("2026-10-28T12:00:00Z");
  assert.equal(windowLeft("2026-10-28T10:00:00Z", now), 22 * 3600e3);
  assert.equal(windowLeft("2026-10-27T10:00:00Z", now), 0);
  assert.equal(windowLeft(null, now), 0);
});
