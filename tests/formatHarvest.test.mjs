import { test } from "node:test";
import assert from "node:assert/strict";
import { harvestItems, genericise, formQuality, headingOf, titleKey, minhash, similarity, sectorOf, suggestLearned, execOf } from "../lib/formatHarvest.js";

const tender = { id: "t1", title: "Statutory audit of MGNREGS accounts for 2025-26 (Ref MPSEG/45)", authority: "Madhya Pradesh State Employment Guarantee Council", tender_ref: "2026_MPSEG_545122_1", portal: "MP Tenders", category: "Services" };
const cv = `Form-8\nCurriculum Vitae (CV) of Professional / Key\nPersonnel\n1. Proposed Position: ________\n2. Name of Personnel: ________\n3. Date of Birth: ________\n4. Educational Qualifications: ________\nCertification:\nI am willing to work on the Project and I will be available for entire duration of\nthe Project assignment as required.\nSignature of the personnel ______  Date: ______\nName of the bidder: ________`;
const undertaking = `Annexure-IV\nUNDERTAKING\nTo, The Commissioner, Madhya Pradesh State Employment Guarantee Council\nSub: Tender no. 2026_MPSEG_545122_1 for Statutory audit of MGNREGS accounts for 2025-26\nI/We hereby declare that our firm has not been blacklisted by any Government department.\nI/We undertake that the information given is true.\nName of the bidder: ________\nSignature of authorised signatory with seal\nPlace: ______ Date: ______`;

test("a tender's own particulars become placeholders and blanks become boxes", () => {
  const g = genericise(undertaking, tender);
  assert.match(g, /\{authority\}/);
  assert.match(g, /\{tender_ref\}/);
  assert.match(g, /\{tender_title\}/);
  assert.match(g, /\[TO BE FILLED: Name of the bidder\]/);
  assert.doesNotMatch(g, /545122/);
});

test("broken PDF lines are joined, page footers dropped", () => {
  const g = genericise("form\npart\nof\nonline technical proposal.\nPage 3 of 40\nName of the bidder: ____", {});
  assert.match(g, /^form part of online technical proposal\./);
  assert.doesNotMatch(g, /Page 3/);
});

test("only real forms are kept", () => {
  assert.ok(formQuality(genericise(undertaking, tender)) >= 40);
  const terms = Array.from({ length: 20 }, (_, i) => `${i + 1}. The contractor shall maintain the site and the employer shall pay within 30 days as per clause ${i}.`).join("\n");
  assert.ok(formQuality(terms) < 40);
  assert.ok(formQuality("form\npart\nof\nonline\nBG\nneeds\nto\nbe\nsubmitted\nalong\nwith\nhard\ncopy\nof\ntechnical\nproposal\nat the time of pre proposal presentation for the authority") < 40);
});

test("headings lose their number; a bare number takes the first line", () => {
  assert.equal(headingOf("Annexure 9 - Format for SA 8000 Compliance"), "Format for SA 8000 Compliance");
  assert.equal(headingOf("Form 8", cv), "Curriculum Vitae (CV) of Professional / Key");
  assert.equal(titleKey("Format for Power of Attorney"), titleKey("Power of Attorney format"));
});

test("the same annexure in two tenders is recognised, a different one is not", () => {
  const other = { ...tender, title: "Concurrent audit of district offices", authority: "Rajasthan Rural Livelihood Mission", tender_ref: "2026_RRLM_100200_1" };
  const a = harvestItems([{ title: "Annexure-IV", text: undertaking }], tender)[0];
  const b = harvestItems([{ title: "Annexure 2", text: undertaking.replace(/Madhya Pradesh State Employment Guarantee Council/g, other.authority).replace("2026_MPSEG_545122_1", other.tender_ref).replace("Statutory audit of MGNREGS accounts for 2025-26", other.title) }], other)[0];
  const c = harvestItems([{ title: "Form 8", text: cv }], tender)[0];
  assert.ok(similarity(a.minhash, b.minhash) >= 0.8, String(similarity(a.minhash, b.minhash)));
  assert.ok(similarity(a.minhash, c.minhash) < 0.3);
  assert.equal(a.sector, "audit");
  assert.ok(["declaration", "non_blacklisting"].includes(a.type));
  assert.equal(minhash("x").length, 32);
});

test("industry, execution and suggestions", () => {
  assert.equal(sectorOf({ title: "Construction of community hall" }), "works");
  assert.equal(sectorOf({ title: "Hiring of security guards" }), "manpower");
  assert.equal(sectorOf({ title: "Something", industry_pack: "goods_supply" }), "supply");
  assert.equal(execOf("I, the deponent, solemnly affirm"), "stamp");
  const entries = [{ id: 1, title_key: titleKey("Curriculum Vitae of Key Personnel"), sectors: ["audit"], seen_count: 9 }, { id: 2, title_key: titleKey("Power of Attorney"), sectors: ["works"], seen_count: 3 }];
  assert.deepEqual(suggestLearned("Annexure 5: CV of key personnel (Curriculum Vitae)", "", entries, { sector: "audit" }).map((e) => e.id), [1]);
});
