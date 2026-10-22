import { test } from "node:test";
import assert from "node:assert/strict";
import { rulesFor, ruleHits, parseRule } from "../lib/taxonomy.js";

const CA = ["pro.tax.accounts", "pro.tax.gst", "pro.tax.payroll", "pro.audit.statutory", "pro.audit.concurrent", "pro.audit.special", "pro.consult.dpr", "pro.consult.pmc", "pro.consult.valuation", "pro.consult.mgmt", "pro.legal.all"];
const fits = (title, ids = CA) => rulesFor(ids).filter((r) => ruleHits(r, title)).map((r) => r.k);

test("CA services match real CA tenders", () => {
  for (const t of [
    "Concurrent audit of toll collection, Mumbai–Pune Expressway",
    "RFP for Appointment of Chartered Accountant / Cost Accountant Firms for Assistance in Accounts related tasks",
    "Appointment Statutory Auditor of Swatch Bharat Mission (G) FY 2025-26 - FY 2026-27 (Ref Appointment Statutory)",
    "Invitation of Bids for hiring CA firm for Internal Audit (Ref SSR GSP/Tender/2026-27/03)",
    "Appointment of an Agency for Information Systems (IS) Audit of Core Banking Solution (CBS), ATM Switch",
    "Engagement of DEA Panel-A category Empaneled Transaction Advisor (Ref 32/EE-C08/DUSIB/2026-27)",
    "Empanelment of Advocates for High Court cases",
    "Audit of accounts of Building and Other Construction Workers Welfare Board",
  ]) assert.ok(fits(t).length, t);
});

test("CA services do not match works, supply or engineering tenders", () => {
  for (const t of [
    "SITC of 02 nos. 80 KVA and 02 nos. 20 KVA Online UPS System and buyback of existing/OLD UPS Systems on behalf of CRID, Haryana. (Ref Tender/Hartron/ TDS/2026-27/24)",
    "Selection of the service provider for establishment of Modernization of Land and property Registration Centers (Ref Tender/Hartron/TDS/2026-27/17)",
    "Ward No. 24 jal nigam karyalaya ke nikat advocate yogendra kumar ke mkan hote hue ikbal singh tak",
    "Ree-laying and interlocking Tile in ShaniMandir wali Gali and income tax wali Gali Word no.12",
    "Fire Compliance Works at Various Buildings in KEM Hospital, Parel.",
    "Provision of Safety Fencing and door modifications for Unattended Train Operation (UTO) compliance at Aarey",
    "Kasba Peth Kshetriy Karyalay Antargat Dainndin Performance Based Paddhtine Jhadankam Karane (Ref PMC/DMC-5/KAS)",
    "CAMC of continuous ambient air quality monitoring system(CAAQMS) station at DCRTPP",
    "DPR and Design Consultancy for Const of Community Health Centre CHC Sambhli District Karnal",
    "Consultancy Services for Supervision Consultant for O and M of four lane of Amritsar-Tarn Taran-Harike Section",
    "Electrical Safety ,Power Quality and Energy Audit compliance and allied works at Mulund Maternity Home",
    "Supply and Installation of 10 KW Solar Panel at Roof of Advocate office Gadarwara",
    "PROJECT MANAGEMENT CONSULTANCY SERVICES FOR MITHI RIVER DEVELOPMENT AND POLLUTION CONTROL PROJECT",
    "Expression of Interest (EOI) for appointment of a CERT-In empaneled Third-Party Auditor (TPA)",
    "Tender for Outsourcing for the post of Contractual Driver on the Establishment of District Legal Services Authority",
  ]) assert.deepEqual(fits(t), [], t);
});

test("capital-letter short forms must appear in capitals; context rules need their context", () => {
  assert.deepEqual(parseRule("TDS + return|filing").acr, ["TDS"]);
  assert.ok(fits("Engineering DPR for bridge", ["eng.design.dpr"]).length);
  assert.deepEqual(fits("The dpr of the bridge", ["eng.design.dpr"]), []);
  assert.ok(fits("Filing of TDS returns for the Board").length);
  assert.deepEqual(fits("TDS meter supply"), []);
});
