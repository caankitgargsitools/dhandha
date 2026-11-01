// Web links inside a PDF (pure; no PDF library). GeM bid documents link the buyer's own terms, scope of work, payment
// terms and BOQ as clickable links ("Click here to view the file") — the address is in the PDF's link annotations
// (/URI (…)), not in the page text. Annotations may sit in compressed object streams, so Flate streams are opened too.
import { inflateSync } from "node:zlib";

const unescape = (s) => s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" })[c] ?? String.fromCharCode(parseInt(c, 8)));

function urisIn(text, out) {
  for (const m of text.matchAll(/\/URI\s*\(((?:[^()\\]|\\.)*)\)/g)) out.add(unescape(m[1]).trim());
  for (const m of text.matchAll(/\/URI\s*<([0-9A-Fa-f\s]+)>/g)) out.add(Buffer.from(m[1].replace(/\s/g, ""), "hex").toString("latin1").trim());
}

export function pdfLinks(bytes, { hosts = null, max = 40 } = {}) {
  const buf = Buffer.from(bytes);
  const out = new Set();
  urisIn(buf.toString("latin1"), out);
  // compressed streams (object streams hold annotations in newer PDFs)
  let at = 0;
  for (let n = 0; n < 2000; n++) {
    const s = buf.indexOf("stream", at, "latin1");
    if (s < 0) break;
    let start = s + 6;
    if (buf[start] === 0x0d) start++;
    if (buf[start] === 0x0a) start++;
    const e = buf.indexOf("endstream", start, "latin1");
    if (e < 0) break;
    at = e + 9;
    if (e - start > 5 * 1024 * 1024) continue;
    try { urisIn(inflateSync(buf.subarray(start, e)).toString("latin1"), out); } catch {}
  }
  return [...out].filter((u) => /^https?:\/\//i.test(u) && (!hosts || hosts.test(new URL(u).hostname))).slice(0, max);
}
