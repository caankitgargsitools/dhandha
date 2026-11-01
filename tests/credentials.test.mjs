import { test } from "node:test";
import assert from "node:assert/strict";
import { findCredentials, firmSectors, questionsFor, checkCredentials, CREDENTIALS } from "../lib/credentials.js";

const bankAudit = `Eligibility: The firm should be registered with the Institute of Chartered Accountants of India and empanelled with
C&AG for the current year. The firm should have at least 3 FCA partners and minimum 5 chartered accountants. At least one partner
should hold DISA / CISA. The firm should be in existence for not less than 10 years. Peer review certificate issued by the Peer Review Board.`;

test("finds what a bank-audit tender asks", () => {
  const f = Object.fromEntries(findCredentials(bankAudit).map((x) => [x.key, x]));
  assert.ok(f.icai_frn && f.cag_empanelled && f.disa_cisa && f.peer_review);
  assert.equal(f.fca_partners.need, 3);
  assert.equal(f.ca_count.need, 5);
  assert.equal(f.firm_years.need, 10);
  const it = Object.fromEntries(findCredentials("Bidder must be CMMI Level 3 and ISO/IEC 27001 certified with 50 technical staff on rolls").map((x) => [x.key, x]));
  assert.equal(it.cmmi_level.need, 3);
  assert.ok(it.iso_27001);
  assert.equal(it.it_staff.need, 50);
  assert.ok(findCredentials("valid PSARA licence and labour licence under CLRA").some((x) => x.key === "psara"));
  assert.deepEqual(findCredentials("Supply of chairs"), []);
});

test("firm's industries, questions in the order tenders ask, and the check", () => {
  assert.deepEqual(firmSectors([{ industry: "Finance & accounting", sub: "Audit", label: "Bank branch audit", pack: "ca_audit" }]), ["audit"]);
  const q = questionsFor(["audit"], [{ key: "peer_review", tenders: 40 }, { key: "cag_empanelled", tenders: 12 }]);
  assert.equal(q[0].key, "peer_review");
  assert.equal(q[1].key, "cag_empanelled");
  assert.ok(q.every((c) => c.sectors.includes("audit")));
  const rows = Object.fromEntries(checkCredentials(findCredentials(bankAudit), [
    { key: "cred.cag_empanelled", value: "yes" }, { key: "cred.fca_partners", value: "2" }, { key: "cred.ca_count", value: "6" },
  ]).map((r) => [r.key, r]));
  assert.equal(rows.cag_empanelled.state, "ok");
  assert.equal(rows.fca_partners.state, "bad");
  assert.equal(rows.ca_count.state, "ok");
  assert.equal(rows.peer_review.state, "ask");
  assert.equal(new Set(CREDENTIALS.map((c) => c.key)).size, CREDENTIALS.length);
});

test("industry words for SQL", async () => {
  const { sectorRx } = await import("../lib/credentials.js");
  assert.match(sectorRx(["audit"]), /^\\y\(audit/);
  assert.equal(sectorRx([]), null);
});
