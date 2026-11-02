import { test } from "node:test";
import assert from "node:assert/strict";
import { findBidTerms, termLines, termRisks } from "../lib/bidTerms.js";

test("invitation-only, documents prevail, secrecy, meeting link (study wording)", () => {
  const a = findBidTerms("Bid Details GEM/2026/B/1 Limited Tender Applicable Yes List of Seller Organization for participation ***** ***** Reason for limited tender: OEM.");
  assert.equal(a.invite.kind, "limited");
  assert.equal(a.invite.masked, true);
  const b = findBidTerms("Only enlisted suppliers of EIL who are invited by email may bid. In case of any contradiction between GeM bid and the tender documents, the Tender document shall prevail. Total Quantity on page 1 may be ignored.");
  assert.equal(b.invite.kind, "enlisted");
  assert.equal(b.invite.with, "EIL");
  assert.equal(b.docs_prevail, true);
  const c = findBidTerms("Bidders must email the signed Secrecy Declaration on or before 05.11.2026 15:00; the password will be shared after it. Pre-bid meeting: https://teams.microsoft.com/l/meetup-join/abc123 .");
  assert.equal(c.secrecy.by, "05.11.2026 15:00");
  assert.equal(c.meeting_links[0], "https://teams.microsoft.com/l/meetup-join/abc123");
});

test("money clauses, staff profile, retained workers, post-audit support, EMD terms, GeM rule breaks", () => {
  const x = findBidTerms(`GEM/2026/B/2. Price fall clause shall apply. Supplies may be made at the risk and cost of the supplier. Rejected stores not lifted within 30 days attract ground rent.
    Revision in minimum wages during the contract shall be borne by the contractor and no claim shall be entertained. Late by more than 10 minutes thrice, half day wage shall be deducted.
    Guards must be Ex-servicemen only; age between 25 to 55 years; lady frisker for the currency chest. The existing manpower shall be retained by the new agency.
    Number of Months for which Post Audit Support is required 12. Demand Draft shall not be accepted; EMD through SBI Collect or e-BG via NeSL. Bid security shall remain valid 45 days beyond the bid validity.
    Only local suppliers from Karnataka are eligible. Hard copies of documents shall be submitted to the office. Uploaded ATC shall supersede all GeM terms.`);
  const kinds = x.clauses.map((c) => c.kind);
  for (const k of ["price_fall", "risk_purchase", "demurrage", "wages_yours", "attendance"]) assert.ok(kinds.includes(k), k);
  assert.deepEqual(x.staff_profile.slice(0, 3), ["Age 25–55 years", "Ex-servicemen compulsory", "Lady frisker / female staff needed"]);
  assert.equal(x.retain_workers, true);
  assert.equal(x.post_audit_months, 12);
  assert.deepEqual(x.emd_terms, { refused: ["Demand draft"], ways: ["e-BG through NeSL", "SBI Collect"], beyond_days: 45 });
  assert.deepEqual(x.gem_rule_breaks.map((g) => g.kind), ["local_only", "physical_docs", "atc_override"]);
  const lines = termLines(x, { bidValidityDays: 120 }).join("\n");
  assert.match(lines, /retain the existing workers/);
  assert.match(lines, /12 months of post-audit support/);
  assert.match(lines, /Demand draft not accepted — use e-BG through NeSL \/ SBI Collect/);
  assert.match(lines, /about 165 days/);
  assert.ok(termRisks(x).some((r) => /May break GeM rules: Only bidders from Karnataka/.test(r.label)));
  assert.equal(findBidTerms("Supply of chairs as per specification."), null);
});

test("GST traps, IT warranty costs, price basis, price-sheet rules (Q19, Q35, Q36, Q28)", () => {
  const x = findBidTerms("Bidders shall quote the concessional rate of GST at 0% as MRPL is eligible. GST will be reimbursed at actuals or the quoted rate, whichever is lower. Bids shall be loaded with the guaranteed shaft power. Faulty hard disks will be retained by the bank. A service centre is required in each consignee state. Asset tags with the company logo on every unit. Prices FOR destination. The unit is 600 km from the nearest railhead. Loading and unloading shall be done by the firm. Quoted rates for one year only; an amount for more than one year will be disqualified.");
  assert.equal(x.gst.concessional_pct, 0);
  assert.equal(x.gst.lower_of, true);
  assert.ok(x.gst.loading);
  assert.deepEqual(x.hardware.map((h) => h.kind), ["disks_retained", "service_centres", "asset_tags"]);
  assert.equal(x.price_basis, "FOR destination");
  assert.equal(x.remote_km, 600);
  assert.equal(x.loading_unloading, true);
  assert.match(x.price_sheet_rules[0], /one year only/);
  assert.equal(findBidTerms("Server AMC: GST under reverse charge (RCM) applicable.").gst.reverse_charge, true);
});
