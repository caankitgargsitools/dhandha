import { test } from "node:test";
import assert from "node:assert/strict";
import { unzip } from "../src/unzip.js";

// a.pdf (deflated) and b.txt (stored), made with Python's zipfile
const ZIP = "UEsDBBQAAAAIACJEVl24tBuHHAAAANAHAAAHAAAAZC9hLnBkZstIzcnJVyhISVPIGGWNskZZo6xR1ihrlDVEWQBQSwMEFAAAAAAAIkRWXacCHLYGAAAABgAAAAcAAABkL2IudHh0c21hbGwKUEsBAhQDFAAAAAgAIkRWXbi0G4ccAAAA0AcAAAcAAAAAAAAAAAAAAKSBAAAAAGQvYS5wZGZQSwECFAMUAAAAAAAiRFZdpwIctgYAAAAGAAAABwAAAAAAAAAAAAAApIFBAAAAZC9iLnR4dFBLBQYAAAAAAgACAGoAAABsAAAAAAA=";

test("reads deflated and stored entries", () => {
  const files = unzip(Buffer.from(ZIP, "base64"));
  assert.deepEqual(files.map((f) => f.name), ["a.pdf", "b.txt"]);
  assert.equal(files[0].data.toString(), "hello pdf ".repeat(200));
  assert.equal(files[1].data.toString(), "small\n");
});

test("rejects a non-zip", () => {
  assert.throws(() => unzip(Buffer.from("%PDF-1.4 not a zip at all, just some bytes here")), /not a zip/);
});

test("leaves out entries that unpack beyond the limit", () => {
  const files = unzip(Buffer.from(ZIP, "base64"), { maxBytes: 1000 });
  assert.deepEqual(files.map((f) => f.name), ["b.txt"]);
});
