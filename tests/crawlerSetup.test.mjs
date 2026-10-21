import test from "node:test";
import assert from "node:assert/strict";
import { crawlerCloudInit } from "../lib/crawlerSetup.js";

test("cloud-init script carries settings and cannot be broken by odd input", () => {
  const s = crawlerCloudInit({ supabaseUrl: "https://x.supabase.co", publishableKey: "sb_publishable_abc", ingestKey: "dhk_ABC123$(rm -rf /)" });
  assert.match(s, /^#!\/bin\/bash/);
  assert.match(s, /SUPABASE_URL=https:\/\/x\.supabase\.co\n/);
  assert.match(s, /INGEST_KEY=dhk_ABC123rm-rf\/\n/); // shell characters stripped
  assert.match(s, /chmod 600 crawler\.env/);
  assert.match(s, /--restart unless-stopped --env-file \/opt\/dhandha\/crawler\.env/);
  assert.match(s, /containrrr\/watchtower/);
});
