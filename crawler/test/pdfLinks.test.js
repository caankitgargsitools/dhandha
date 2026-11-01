import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { pdfLinks } from "../src/pdfLinks.js";

test("links in plain and compressed annotations, GeM hosts only", () => {
  const plain = "%PDF-1.4\n1 0 obj << /Type /Annot /Subtype /Link /A << /S /URI /URI (https://bidplus.gem.gov.in/resources/upload_nas/atc\\(1\\).pdf) >> >> endobj\n";
  const packed = deflateSync(Buffer.from("<< /A << /S /URI /URI (https://mkp.gem.gov.in/scope/abc.pdf) >> >> << /URI (https://example.com/x) >>", "latin1"));
  const pdf = Buffer.concat([Buffer.from(plain, "latin1"), Buffer.from("5 0 obj << /Filter /FlateDecode >> stream\r\n", "latin1"), packed, Buffer.from("\r\nendstream endobj\n%%EOF", "latin1")]);
  const all = pdfLinks(pdf);
  assert.deepEqual(all.sort(), ["https://bidplus.gem.gov.in/resources/upload_nas/atc(1).pdf", "https://example.com/x", "https://mkp.gem.gov.in/scope/abc.pdf"].sort());
  assert.deepEqual(pdfLinks(pdf, { hosts: /(^|\.)gem\.gov\.in$/ }).length, 2);
  assert.deepEqual(pdfLinks(Buffer.from("no links here")), []);
});
