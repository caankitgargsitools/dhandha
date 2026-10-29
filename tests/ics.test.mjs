import { test } from "node:test";
import assert from "node:assert/strict";
import { toIcs, fold } from "../lib/ics.js";

const now = new Date("2026-10-29T00:00:00Z");

test("timed and all-day events", () => {
  const ics = toIcs([
    { uid: "close-1", title: "Bid closes: Road, drain; works", at: "2026-10-30T04:30:00+00:00", where: "GePNIC", url: "https://x.gov.in/a", note: "PWD" },
    { uid: "bg-2", title: "Bank guarantee expires", date: "2026-11-30", all_day: true },
    { uid: "bad", title: "No date", all_day: true },
  ], { name: "GSC bids", now });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261030T043000Z\r\nDTEND:20261030T050000Z/);
  assert.match(ics, /SUMMARY:Bid closes: Road\\, drain\; works/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /X-WR-CALNAME:GSC bids/);
});

test("long lines are folded at 75 octets", () => {
  const f = fold("SUMMARY:" + "₹".repeat(40));
  assert.ok(f.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
  assert.equal(f.replace(/\r\n /g, ""), "SUMMARY:" + "₹".repeat(40));
});
