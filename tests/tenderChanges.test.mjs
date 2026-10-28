import { test } from "node:test";
import assert from "node:assert/strict";
import { changeText, realChange, latestByTender } from "../lib/tenderChanges.js";

test("corrigenda in plain words", () => {
  assert.equal(changeText({ field: "due_at", old_value: "2026-10-30 12:30:00+00", new_value: "2026-11-06T18:00:00+05:30" }), "Closing 30 Oct 18:00 → 06 Nov 18:00");
  assert.equal(changeText({ field: "value_inr", old_value: "995500.00", new_value: "950000" }), "Value ₹9.96 lakh → ₹9.50 lakh");
  assert.equal(changeText({ field: "emd_inr", old_value: "25000", new_value: "30000" }), "EMD ₹25,000 → ₹30,000");
  assert.equal(changeText({ field: "status", old_value: "live", new_value: "cancelled" }), "Status: cancelled");
  assert.equal(realChange({ old_value: "1463138.00", new_value: null }), false);
  const by = latestByTender([{ tender_id: "a", old_value: "1", new_value: "2" }, { tender_id: "a", old_value: "2", new_value: "3" }, { tender_id: "a", old_value: "3", new_value: "4" }, { tender_id: "b", old_value: "1", new_value: null }]);
  assert.equal(by.a.length, 2); assert.equal(by.b, undefined);
});
