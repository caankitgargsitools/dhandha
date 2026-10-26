import { test } from "node:test";
import assert from "node:assert/strict";
import { monthOf, pickLatest, pickRecent, looksBlocked, mcaDocLinks } from "../src/mcaPick.js";

test("month from link text or file name", () => {
  assert.equal(monthOf("Companies incorporated in September 2026"), 202609);
  assert.equal(monthOf("Incorporation_Aug_2026.xlsx"), 202608);
  assert.equal(monthOf("data-07-2026.xlsx"), 202607);
  assert.equal(monthOf("2026_10 list.xlsx"), 202610);
  assert.equal(monthOf("Company statistics"), null);
});

test("newest monthly file wins, xlsx preferred", () => {
  const l = pickLatest([
    { href: "/content/dam/mca/Aug_2026.xlsx", text: "August 2026" },
    { href: "/content/dam/mca/Sep_2026.xls", text: "September 2026" },
    { href: "/content/dam/mca/Sep_2026.xlsx", text: "September 2026" },
    { href: "/about.html", text: "October 2026" },
  ]);
  assert.equal(l.href, "/content/dam/mca/Sep_2026.xlsx");
  assert.equal(l.month, 202609);
});

test("bot checks are recognised", () => {
  assert.equal(looksBlocked(403, ""), true);
  assert.equal(looksBlocked(200, "<title>Access Denied</title>"), true);
  assert.equal(looksBlocked(200, "<h1>Data & Reports</h1>"), false);
});

test("last six months, one file each, oldest first", () => {
  const links = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((m) => ({ href: `/dam/${m}_2026.xlsx`, text: `${m} 2026` }));
  links.push({ href: "/dam/Sep_2026.xls", text: "Sep 2026" });
  const r = pickRecent(links, 6);
  assert.deepEqual(r.map((x) => x.month), [202604, 202605, 202606, 202607, 202608, 202609]);
  assert.equal(r.at(-1).href, "/dam/Sep_2026.xlsx");
});

test("MCA document links without an extension count, by the month in their text", () => {
  const r = pickRecent([
    { href: "https://www.mca.gov.in/bin/dms/getdocument?mds=abc&type=open", text: "Companies registered during September 2026" },
    { href: "https://www.mca.gov.in/bin/dms/getdocument?mds=def&type=open", text: "Companies registered during August 2026" },
    { href: "https://www.mca.gov.in/content/mca/global/en/home.html", text: "Home 2026" },
  ], 6);
  assert.deepEqual(r.map((x) => x.month), [202608, 202609]);
});

test("MCA document list (JSON inside JSON) gives the registration files by month", () => {
  const inner = JSON.stringify([
    { column1: "Companies and LLPs registered in September' 2026", docType: "xlsx", docID: "%2BC%2FPSkCyPTLPkCAWMj5Slg%3D%3D" },
    { column1: "Companies and LLPs registered in August' 2026", docType: "xlsx", docID: "eec%2BsyixrJD7PPnUMk4W9w%3D%3D" },
    { column1: "Companies struck off/closed us 248(2) of Companies Act, 2013 September' 2026", docType: "xlsx", docID: "x" },
  ]);
  const links = mcaDocLinks(JSON.stringify({ documentDetails: inner, totalResults: 126 }));
  assert.equal(links.length, 2);
  assert.equal(links[0].href, "https://www.mca.gov.in/bin/dms/getdocument?mds=%2BC%2FPSkCyPTLPkCAWMj5Slg%3D%3D&type=open");
  const r = pickRecent(links, 6);
  assert.deepEqual(r.map((x) => x.month), [202608, 202609]);
});
