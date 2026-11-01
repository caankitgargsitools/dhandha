import { test } from "node:test";
import assert from "node:assert/strict";
import { blocks, toDocHtml, fromDocHtml, fromDocxXml, toCsv, parseCsv, withSheetTables, prefersSheet, hasTables } from "../lib/gdocs.js";

const text = `DECLARATION\nWe, Sharma & Associates, declare that:\nPAN: [TO BE FILLED: PAN]\n⟦table Work|Client|Value (Rs.)⟧\nBranch audit|PNB|32,00,000\n||\n⟦/table⟧\nPlace: Gurugram`;

test("a format goes to a document with real tables and highlighted boxes, and comes back the same", () => {
  const html = toDocHtml(text, { title: "Annexure 4" });
  assert.match(html, /<table/);
  assert.match(html, /background:#fff3a3">\[TO BE FILLED: PAN\]/);
  assert.match(html, /Sharma &amp; Associates/);
  const back = fromDocHtml(html);
  assert.match(back, /^DECLARATION\nWe, Sharma & Associates, declare that:\nPAN: \[TO BE FILLED: PAN\]/);
  assert.match(back, /⟦table Work\|Client\|Value \(Rs\.\)⟧\nBranch audit\|PNB\|32,00,000\n⟦\/table⟧/);
  assert.match(back, /Place: Gurugram$/);
  assert.match(toDocHtml(text, { word: true }), /urn:schemas-microsoft-com:office:word/);
});

test("what someone typed in Google Docs comes back (Google's export markup)", () => {
  const g = `<html><head><style>.c1{color:red}</style></head><body class="c5"><p class="c2"><span class="c1">PAN: AAKFS1234K</span></p><p><span>Name&nbsp;of the bidder: Sharma &amp; Co.</span></p><table class="c9"><tr><td><p><span>Work</span></p></td><td><p><span>Client</span></p></td></tr><tr><td><p><span>GST audit</span></p></td><td><p><span>HSIIDC</span></p></td></tr></table><p><span>Signed</span></p></body></html>`;
  const t = fromDocHtml(g);
  assert.equal(t, "PAN: AAKFS1234K\nName of the bidder: Sharma & Co.\n⟦table Work|Client⟧\nGST audit|HSIIDC\n⟦/table⟧\nSigned");
});

test("a filled Word file comes back", () => {
  const xml = `<w:document><w:body><w:p><w:r><w:t>Name of the bidder: </w:t></w:r><w:r><w:t xml:space="preserve">Sharma &amp; Co.</w:t></w:r></w:p><w:p/><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Work</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Client</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Audit</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>PNB</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`;
  assert.equal(fromDocxXml(xml), "Name of the bidder: Sharma & Co.\n\n⟦table Work|Client⟧\nAudit|PNB\n⟦/table⟧");
});

test("tables go to a spreadsheet and the filled rows come back into the format", () => {
  const csv = toCsv(text);
  assert.equal(csv, "Work,Client,Value (Rs.)\nBranch audit,PNB,\"32,00,000\"\n,,\n");
  const rows = parseCsv("Work,Client,Value (Rs.)\nBranch audit,PNB,\"32,00,000\"\nGST audit,HSIIDC,\"5,00,000\"\n");
  const t = withSheetTables(text, rows);
  assert.match(t, /GST audit\|HSIIDC\|5,00,000/);
  assert.match(t, /^DECLARATION/);
  assert.match(t, /Place: Gurugram$/);
  assert.equal(parseCsv("'=SUM(A1),x\n")[0][0], "=SUM(A1)");
  assert.equal(toCsv("⟦table A⟧\n=cmd\n⟦/table⟧"), "A\n'=cmd\n");
});

test("which editor suits a format", () => {
  assert.equal(hasTables(text), true);
  assert.equal(prefersSheet(text), false);
  assert.equal(prefersSheet("Name: x\n⟦table A|B⟧\n1|2\n3|4\n⟦/table⟧"), true);
  assert.equal(blocks("plain").length, 1);
});

test("Word's saved HTML, multi-paragraph cells, section breaks and Google's padded CSV come back cleanly", () => {
  assert.equal(fromDocHtml(`<body><p class=MsoNormal><b>Name:</b>\r\n<span>Sharma &amp; Co.</span> declares\r\nthat it is not blacklisted</p><table><tr><td><p>Work</p></td></tr><tr><td><p>GST</p><p>audit</p></td></tr></table></body>`),
    "Name: Sharma & Co. declares that it is not blacklisted\n⟦table Work⟧\nGST audit\n⟦/table⟧");
  const xml = `<w:document><w:body><w:p><w:r><w:t>Part one</w:t></w:r><w:pPr><w:sectPr/></w:pPr></w:p><w:p><w:r><w:t>Part two</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`;
  assert.equal(fromDocxXml(xml), "Part one\nPart two");
  const two = "⟦table A|B⟧\n1|2\n⟦/table⟧\n⟦table P|Q|R|S⟧\n⟦/table⟧\n";
  const t = withSheetTables(two, parseCsv("A,B,,\n3,4,,\n,,,\nP,Q,R,S\nw,x,y,z\n"));
  assert.match(t, /^⟦table A\|B⟧\n3\|4\n⟦\/table⟧/);
  assert.match(t, /⟦table P\|Q\|R\|S⟧\nw\|x\|y\|z/);
});
