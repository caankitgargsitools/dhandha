import { test } from "node:test";
import assert from "node:assert/strict";
import { domainAllowed, widgetScript } from "../lib/widget.js";

test("allowed sites", () => {
  assert.equal(domainAllowed([], "https://anything.in"), true);
  assert.equal(domainAllowed(["example.com"], "https://www.example.com"), true);
  assert.equal(domainAllowed(["https://example.com/"], "https://shop.example.com"), true);
  assert.equal(domainAllowed(["example.com"], "https://badexample.com"), false);
  assert.equal(domainAllowed(["example.com"], ""), false);
});

test("the script carries the settings safely", () => {
  const js = widgetScript({ endpoint: "https://d.app/api/widget/abc", cfg: { title: 'Say "hi"</script>', greeting: "Hello", color: "#112233", whatsapp: "919810012345", ask_email: true } });
  assert.match(js, /https:\/\/d\.app\/api\/widget\/abc/);
  assert.match(js, /"Say \\"hi\\"<\/script>"/); // JSON-escaped, set with textContent
  assert.match(js, /wa\.me/);
  assert.doesNotThrow(() => new Function(js)); // valid JavaScript
});
