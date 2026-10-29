import { test } from "node:test";
import assert from "node:assert/strict";
import { fillReply, filterReplies, cleanShortcut, STARTERS } from "../lib/savedReplies.js";

test("placeholders are filled from the conversation", () => {
  const t = fillReply("Thank you {first_name}! This is {my_name} from {my_company}.", { contact: "Mr. Ravi Kumar", myName: "Neha Gupta", myCompany: "Sharma & Associates" });
  assert.equal(t, "Thank you Ravi! This is Neha from Sharma & Associates.");
  assert.equal(fillReply("Hello {first_name}", {}), "Hello there");
  assert.equal(fillReply("Dear {name} of {company}, ok", { name: "Sita" }), "Dear Sita of, ok");
  assert.equal(fillReply("Keep {unknown} as is", {}), "Keep {unknown} as is");
});

test("search and order", () => {
  const list = [{ title: "Fees", shortcut: "fees", body: "our fee", uses: 2 }, { title: "Bank", shortcut: "bank", body: "IFSC", uses: 5 }, { title: "Old", body: "x", archived: true }];
  assert.deepEqual(filterReplies(list).map((r) => r.title), ["Bank", "Fees"]);
  assert.deepEqual(filterReplies(list, "/fee").map((r) => r.title), ["Fees"]);
  assert.deepEqual(filterReplies(list, "ifsc").map((r) => r.title), ["Bank"]);
});

test("shortcuts and starters", () => {
  assert.equal(cleanShortcut("/Fees 2!"), "fees2");
  assert.equal(cleanShortcut(""), null);
  assert.ok(STARTERS.length >= 5 && STARTERS.every((s) => s.title && s.body && s.shortcut));
});
