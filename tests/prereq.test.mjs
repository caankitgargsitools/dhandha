import { test } from "node:test";
import assert from "node:assert/strict";
import { findPrerequisites, prerequisiteList, grouped } from "../lib/prereq.js";

const pages = [
  "NOTICE INVITING TENDER. EMD of Rs. 50,000 shall be submitted in the form of Demand Draft or Bank Guarantee from a scheduled bank. MSEs registered with Udyam are exempted from EMD. Tender fee Rs 1,180 to be paid online.",
  "Eligibility: The firm must be ICAI peer reviewed and empanelled with C&AG. ISO 9001 certificate is required. Audited balance sheets for the last three financial years and a turnover certificate from a Chartered Accountant.",
  "Bidders shall submit an affidavit on non-judicial stamp paper of Rs. 100 that they have not been blacklisted by any government department. Signatures of the authorised signatory verified by the bank. The original DD shall be submitted physically before the bid closing date. Solvency certificate of Rs. 10 lakh from a nationalised bank.",
  "Contractor should be registered in Class III with the department.",
];

test("finds the things to arrange, with the page", () => {
  const f = findPrerequisites(pages);
  const keys = f.map((x) => x.key);
  for (const k of ["solvency", "bank_signature", "affidavit", "blacklist", "iso", "peer_review", "cag", "ca_turnover", "balance_sheets", "hard_copy"]) assert.ok(keys.includes(k), k);
  assert.ok(!keys.includes("dsc"), "contractor class III is not a DSC");
  assert.equal(f.find((x) => x.key === "iso").label, "ISO 9001 certificate, valid on the bid date");
  assert.equal(f.find((x) => x.key === "balance_sheets").label, "Audited balance sheets for the last 3 years");
  assert.equal(f.find((x) => x.key === "affidavit").label, "Notarised affidavit on ₹100 stamp paper");
  assert.equal(f.find((x) => x.key === "solvency").label, "Bank solvency certificate of ₹10 lakh");
  assert.equal(f.find((x) => x.key === "solvency").page, 3);
  const modes = f.find((x) => x.key === "_modes");
  assert.deepEqual(modes.emd, ["Demand draft", "Bank guarantee"]);
  assert.deepEqual(modes.fee, ["Online payment"]);
  assert.equal(modes.mse, true);
});

test("list merges numbers, unmet conditions and missing Vault documents", () => {
  const found = findPrerequisites(pages);
  const items = prerequisiteList({ found, fields: { emd_inr: 50000, tender_fee_inr: 1180, performance_security_pct: 3 }, unmet: ["Branch office in Bihar"], checklist: [{ code: "gst", name: "GST certificate", state: "missing" }, { code: "pan", name: "PAN", state: "ok" }] });
  assert.equal(items[0].label, "EMD ₹50,000 as Demand draft / Bank guarantee — MSEs are exempt");
  assert.equal(items[1].label, "Tender fee ₹1,180 as Online payment");
  assert.match(items[2].label, /^Performance security 3%/);
  assert.ok(items.some((x) => x.key === "dsc"), "DSC is always listed");
  assert.ok(items.some((x) => x.group === "unmet" && x.warn));
  assert.deepEqual(items.filter((x) => x.group === "vault").map((x) => x.label), ["GST certificate"]);
  const g = grouped(items);
  assert.equal(g[0].title, "Money and bank instruments");
});

test("MSE firm gets the exemption line", () => {
  const items = prerequisiteList({ found: findPrerequisites(pages), fields: { emd_inr: 50000 }, msme: true });
  assert.match(items[0].label, /exempt for MSEs: keep your Udyam certificate ready/);
});

test("AI lines that repeat a found item are dropped", () => {
  const items = prerequisiteList({ found: findPrerequisites(pages), fields: { emd_inr: 50000 }, aiLines: ["EMD of Rs 50,000 by DD", "Solvency certificate Rs 10 lakh", "Valid trade licence"] });
  const ai = items.filter((x) => x.ai).map((x) => x.label);
  assert.deepEqual(ai, ["Valid trade licence"]);
});
