import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBihar } from "../src/adapters/biharEproc.js";

// records as eproc2.bihar.gov.in's getTenderList answered on 28 Oct 2026 (trimmed)
const list = [
  { tenderid: 0, currenttenderid: 141486, currenttenderrefno: "NIT/BSEDC/08/27/2026-27 Dated: 01.10.2026", currentdeptid: 1345, currentpacamt: null,
    currentdescription: "REQUEST FOR PROPOSAL (RFP) FOR SELECTION OF IMPLEMENTATION AGENCY FOR DESIGN, DEVELOPMENT OF THE INTELLIGENT TENDER EVALUATION SYSTEM (iTES)",
    currentbidEndDate: 1793187012000, currentbidOpenDate: 1793359812000, currentTenderPublishDate: 1791373217000 },
  { currenttenderid: 141833, currenttenderrefno: "NIT 30/TEN/IDA/26", currentdeptid: 1532, currentpacamt: "4523000.50",
    currentdescription: "Remaining Work of Construction of RCC Precast Storm Water Drainage at EPIP Campus, I/A Hajipur", currentbidEndDate: 1793187000000 },
  { currenttenderid: 0, currentdescription: "no id" },
];
const depts = [{ organizationId: 1345, organizationName: "Bihar State Electronics Development Corporation" }];

test("Bihar open-area list → tenders", () => {
  const [a, b, c] = parseBihar(list, depts);
  assert.equal(c, undefined);
  assert.equal(a.tender_ref, "141486");
  assert.equal(a.authority, "Bihar State Electronics Development Corporation");
  assert.match(a.title, /\(Ref NIT\/BSEDC\/08\/27\/2026-27 Dated: 01.10.2026\)$/);
  assert.equal(a.due_at, new Date(1793187012000).toISOString());
  assert.equal(a.published_on, "2026-10-07");
  assert.equal(a.value_inr, null);
  assert.equal(a.state, "Bihar");
  assert.equal(b.authority, "Government of Bihar");
  assert.equal(b.value_inr, 4523000.5);
  assert.equal(b.industry_pack, "construction");
});
