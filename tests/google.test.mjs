import test from "node:test";
import assert from "node:assert/strict";
import { encryptToken, decryptToken, authUrl, emailFromIdToken } from "../lib/google.js";

test("refresh token round-trips and cannot be read with another secret", () => {
  const enc = encryptToken("1//0g-refresh-token", "secret-A");
  assert.notEqual(enc, encryptToken("1//0g-refresh-token", "secret-A")); // fresh IV every time
  assert.equal(decryptToken(enc, "secret-A"), "1//0g-refresh-token");
  assert.throws(() => decryptToken(enc, "secret-B"));
  assert.throws(() => decryptToken("garbage", "secret-A"), /reconnect/);
});

test("consent URL asks only for drive.file, offline", () => {
  const u = new URL(authUrl({ clientId: "cid", redirectUri: "https://x.in/api/google/callback", state: "s1" }));
  assert.equal(u.searchParams.get("scope"), "openid email https://www.googleapis.com/auth/drive.file");
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("prompt"), "consent");
  assert.equal(u.searchParams.get("state"), "s1");
});

test("email from id_token payload", () => {
  const tok = `x.${Buffer.from(JSON.stringify({ email: "owner@firm.in" })).toString("base64url")}.y`;
  assert.equal(emailFromIdToken(tok), "owner@firm.in");
  assert.equal(emailFromIdToken("nonsense"), null);
});
