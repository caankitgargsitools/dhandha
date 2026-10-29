import { test } from "node:test";
import assert from "node:assert/strict";
import { wbDate, mapWbNotice, wbList } from "../lib/globalTenders.js";

const now = new Date("2026-10-29T00:00:00Z");

test("World Bank dates", () => {
  assert.equal(wbDate("14-Nov-2026", "14:00"), "2026-11-14T14:00:00Z");
  assert.equal(wbDate("2026-11-14T00:00:00Z"), "2026-11-14T23:59:00Z");
  assert.equal(wbDate("rubbish"), null);
});

test("a notice becomes a tender", () => {
  const t = mapWbNotice({ id: "OP00412345", notice_type: "Request for Expression of Interest", bid_description: "Hiring of <b>Internal Auditor</b> for PIU",
    project_name: "Bihar Rural Roads", project_ctry_name: "India", procurement_group: "CS", submission_deadline_date: "2026-11-20", noticedate: "28-Oct-2026" }, now);
  assert.equal(t.portal, "World Bank");
  assert.equal(t.title, "Hiring of Internal Auditor for PIU");
  assert.equal(t.state, null);
  assert.equal(t.industry_pack, null);
  assert.equal(t.published_on, "2026-10-28");
  assert.match(t.url, /procurement-detail\/OP00412345$/);
  const abroad = mapWbNotice({ id: "X1", notice_type: "Invitation for Bids", bid_description: "Supply of laptops", project_ctry_name: "Nepal", procurement_group: "GO", submission_deadline_date: "2026-12-01" }, now);
  assert.equal(abroad.state, "Abroad: Nepal");
  assert.equal(abroad.industry_pack, "goods_supply");
});

test("closed, awarded and contract notices are left out", () => {
  assert.equal(mapWbNotice({ id: "1", notice_type: "Invitation for Bids", bid_description: "x", submission_deadline_date: "2026-01-01" }, now), null);
  assert.equal(mapWbNotice({ id: "2", notice_type: "Contract Award", bid_description: "x", submission_deadline_date: "2026-12-01" }, now), null);
  assert.equal(wbList({ procnotices: { a: { id: 1 }, b: { id: 2 } } }).length, 2);
  assert.equal(wbList({}).length, 0);
});
