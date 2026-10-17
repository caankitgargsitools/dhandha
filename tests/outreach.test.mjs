import test from "node:test";
import assert from "node:assert/strict";
import { emailHtml, emailText, whatsappPayload } from "../lib/outreach.js";

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
