import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIstDate, parseNtpcRows, parseSail } from "../src/adapters/psu.js";

test("India-time dates in the PSU formats", () => {
  assert.equal(parseIstDate("07 Nov 2026 3:00 PM"), "2026-11-07T09:30:00.000Z");
  assert.equal(parseIstDate("Nov 14 2026  2:00:00:000PM"), "2026-11-14T08:30:00.000Z");
  assert.equal(parseIstDate("29 Oct 2026 12:55:00"), "2026-10-29T07:25:00.000Z");
  assert.equal(parseIstDate("1/1/1900 12:00:00 AM"), null);
});

test("NTPC live-tender table rows", () => {
  // as seen on ntpctender.ntpc.co.in/Index/Search?Type=Reg&Region=1 on 28 Oct 2026
  const rows = [
    { cells: ["S.No", "NIT No"], href: null },
    { cells: ["2", "GEM/2026/B/8207197", "AMC including Calibration of Microwave Digestor (MWD) at NETRA (opens in a new tab)", "Corporate Contracts", "07 Nov 2026 3:00 PM", "10 days left", "View tender GEM/2026/B/8207197"], href: "https://ntpctender.ntpc.co.in/Index/NITDetail?id=1" },
    { cells: ["3", "CS-9590-302-9", "Gate Complex (North West) and Fire Station Package For Hydrogen Hub of NGEL at Pudimadaka, Andhra Pradesh", "Corporate Contracts", "30 Nov 2026 1:00 PM", "33 days left", "View tender"], href: null },
  ];
  const [a, b] = parseNtpcRows(rows);
  assert.equal(a.tender_ref, "GEM/2026/B/8207197");
  assert.match(a.title, /^AMC including Calibration of Microwave Digestor \(MWD\) at NETRA \(Ref GEM\/2026\/B\/8207197\)$/);
  assert.equal(a.authority, "NTPC Limited — Corporate Contracts");
  assert.equal(a.due_at, "2026-11-07T09:30:00.000Z");
  assert.equal(a.url, "https://ntpctender.ntpc.co.in/Index/NITDetail?id=1");
  assert.equal(b.tender_ref, "CS-9590-302-9");
  assert.equal(parseNtpcRows([{ cells: ["S.No", "NIT No", "Description", "Location"] }]).length, 0);
});

test("SAIL lists (issued today, closing in three days)", () => {
  const today = [[{ procurementId: "106675", TenderNo: "HR-Works / Cafe / 2026/365 date - 21.10.2026", nameofWork: "Durgapur Steel Plant (DSP) will give license for running a Cafeteria", TenderopeningDate: "Oct 28 2026  8:00:00:000AM", BidSubmissionClosingDate: "Nov 14 2026  2:00:00:000PM" }]];
  const closing = [[{ TenderNo: " CCNW/TSD/PR-1130029351 ", nameofWork: "Cr&#232;che &amp; Day Care facility", TenderOpeningDate: "15 Oct 2026 11:00:00", BidSubmissionClosingDate: "Oct 29 2026  1:00:00", procurementId: "106605", Circle_Division: "Bhilai Steel Plant" },
    { procurementId: "106675", TenderNo: "dup", nameofWork: "dup" }]];
  const rows = parseSail([today, closing]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].tender_ref, "106675");
  assert.equal(rows[0].due_at, "2026-11-14T08:30:00.000Z");
  assert.equal(rows[1].authority, "Steel Authority of India Limited — Bhilai Steel Plant");
  assert.match(rows[1].title, /^Crèche & Day Care facility \(Ref CCNW\/TSD\/PR-1130029351\)$/);
});
