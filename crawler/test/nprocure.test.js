import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNprocure, nprocureDate } from "../src/adapters/nprocure.js";

// one record as tender.nprocure.com's beforeLoginTenderTableList answers (27 Oct 2026)
const json = JSON.parse(String.raw`{"recordsFiltered":3381,"iTotalRecords":3381,"data":[{"1":"E-Tender Notice No. 03 2026-27, Sr. No. 03","2":"<html><body><span style=color:#f44336; >GIDC-Division Office - Vapi<form action='/view-nit-home' method='POST' target='_blank' class='d-inline ml-5 mb-2' style='text-decoration: underline;'><input type='hidden' name='_csrf' value='token'><input type='hidden' name='tenderid' id='tenderid_359834' value='359834'/>\n<a href='#' onClick='$(this).closest(\"form\").submit();'  id='tenderInProgress' class='edit1'>Tender Id :359834<\/a><\/form><\/span><span style=color:#FF9933; ><form action='/view-nit-home' method='POST' target='_blank' class='mt-2 mb-1' style='text-decoration: underline;'><input type='hidden' name='_csrf' value='token'><input type='hidden' name='tenderid' id='tenderid_359834' value='359834'/>\n<a href='#' onClick='$(this).closest(\"form\").submit();'  id='tenderInProgress' class='edit1'><strong style='color: maroon;'>Name Of Work :<\/strong>Providing high end cleaning services surrounding approaches/Entry roads of Hazira GIDC & disposal of waste at Dumping site.<\/a><\/form><\/span>\n<p style=color:#FF9933;display:block; class='mb-2'> Estimated Contract Value : 2777684.40\n<p style=color:#000000; class='mt-2 mb-0'> Last Date & Time For Submission : 13-11-2026 17:00:00<\/body><\/html>","3":"<form>Total No:4 <\/a><\/form>"}]}`);

test("nProcure list answer -> tenders", () => {
  const [r] = parseNprocure(json);
  assert.equal(r.tender_ref, "359834");
  assert.equal(r.title, "Providing high end cleaning services surrounding approaches/Entry roads of Hazira GIDC & disposal of waste at Dumping site.");
  assert.equal(r.authority, "GIDC-Division Office - Vapi");
  assert.equal(r.summary, "Notice: E-Tender Notice No. 03 2026-27, Sr. No. 03");
  assert.equal(r.value_inr, 2777684.4);
  assert.equal(r.due_at, "2026-11-13T17:00:00+05:30");
  assert.equal(r.state, "Gujarat");
  assert.equal(nprocureDate("bad"), null);
});
