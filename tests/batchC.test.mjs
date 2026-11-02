import test from "node:test";
import assert from "node:assert/strict";
import { masterPlan, masterStatus, currentFy } from "../lib/masterPlan.js";
import { findCredentials, checkCredentials } from "../lib/credentials.js";
import { extractConditions } from "../lib/conditions.js";
import { oemCheck } from "../lib/oem.js";

test("currentFy follows April–March", () => {
  assert.equal(currentFy(new Date("2026-11-02")), "FY 2026-27");
  assert.equal(currentFy(new Date("2027-02-10")), "FY 2026-27");
});

test("GeM profile turnover is asked again each financial year (Q15)", () => {
  const items = masterPlan({ buyers: ["gem"] }).filter((i) => i.key === "reg.gem_profile_turnover");
  const now = new Date("2026-11-02");
  assert.equal(masterStatus(items, { now, facts: [{ key: "reg.gem_profile_turnover", period: "FY 2026-27", value: "yes" }] })[0].done, true);
  const old = masterStatus(items, { now, facts: [{ key: "reg.gem_profile_turnover", period: "FY 2025-26", value: "yes" }] })[0];
  assert.equal(old.done, false);
  assert.equal(old.note, "update for FY 2026-27");
});

test("bank buyers ask for a cancelled cheque and EFT mandate (Q17)", () => {
  const ids = masterPlan({ buyers: ["banks"] }).map((i) => i.id);
  assert.ok(ids.includes("d:BANK-CHEQUE") && ids.includes("d:BANK-EFT"));
});

test("staff by type and people deployed (Q22)", () => {
  const f = findCredentials(["The agency should have at least 50 ex-servicemen and 20 armed guards. It must have deployed not less than 200 persons in a single contract. Deployment of 300 security guards at the site."]);
  const keys = f.map((x) => x.key);
  assert.ok(keys.includes("armed_guards") && keys.includes("ex_servicemen") && keys.includes("max_deployed"));
  assert.ok(!keys.includes("unarmed_guards"));
  const row = checkCredentials(f, [], [{ people_deployed: 250 }]).find((r) => r.key === "max_deployed");
  assert.equal(row.state, "ok");
  assert.equal(checkCredentials(f, [{ key: "cred.max_deployed", value: "100" }], [{ people_deployed: 250 }]).find((r) => r.key === "max_deployed").state, "bad");
});

test("office for N years and native-state conditions (Q32)", () => {
  assert.deepEqual(extractConditions(["The bidder must have an office in Bihar for the last 3 years."], {}).map((c) => c.key), ["presence.office.bihar", "presence.office.bihar.years_3"]);
  assert.deepEqual(extractConditions(["Only firms registered in the State of Odisha are eligible."], {}).map((c) => c.key), ["native.state.odisha"]);
  assert.deepEqual(extractConditions(["The bidder should be a native of the state."], { state: "Assam" }).map((c) => c.key), ["native.state.assam"]);
});

test("product certificates asked by a GeM bid (Q35)", () => {
  const rows = oemCheck({ gem: { documents_required: "OEM Authorization Certificate, BIS certificate, EPR registration" }, title: "Supply of Desktop Computer", oems: [{ brand: "HP", products: "desktop", certs: ["bis_crs"] }] });
  assert.equal(rows.find((r) => r.key === "cert_bis_crs").state, "ok");
  assert.equal(rows.find((r) => r.key === "cert_epr").state, "ask");
  assert.ok(!rows.some((r) => r.key === "cert_stqc"));
});
