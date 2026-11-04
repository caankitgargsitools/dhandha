import test from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../lib/safeNext.js";

test("safeNext keeps app and admin paths with a query string", () => {
  assert.equal(safeNext("/app/tenders/abc-123"), "/app/tenders/abc-123");
  assert.equal(safeNext("/app/vault/masters?item=d%3AREG-PAN"), "/app/vault/masters?item=d%3AREG-PAN");
  assert.equal(safeNext("/admin"), "/admin");
});

test("safeNext refuses other sites and odd paths", () => {
  for (const bad of ["https://evil.com", "//evil.com", "/app//evil.com", "/\\evil.com", "/login", "/app/../admin", "javascript:alert(1)", "", null])
    assert.equal(safeNext(bad), "/app", String(bad));
});
