// Minimal ZIP reader (stored and deflated entries) for portals that only offer "Download as zip file".
import { inflateRawSync } from "node:zlib";

// An entry that would unpack to more than maxBytes (25 MB by default) is left out, so a zip bomb cannot fill memory.
export const MAX_BYTES = 25 * 1024 * 1024;
export function unzip(buf, { maxBytes = MAX_BYTES } = {}) {
  const b = Buffer.from(buf);
  // end of central directory: signature 0x06054b50, searched from the end (comment may follow)
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip directory");
    // central directory entry: 10 method, 20 compressed size, 24 size, 28 name length, 30 extra, 32 comment, 42 local header
    const method = b.readUInt16LE(p + 10), comp = b.readUInt32LE(p + 20), size = b.readUInt32LE(p + 24);
    const nameLen = b.readUInt16LE(p + 28), extraLen = b.readUInt16LE(p + 30), commentLen = b.readUInt16LE(p + 32), local = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const raw = b.subarray(start, start + comp);
    if (size > maxBytes || (method === 0 && raw.length > maxBytes)) continue;
    let data = null;
    try { data = method === 0 ? raw : method === 8 ? inflateRawSync(raw, { maxOutputLength: maxBytes }) : null; } catch { continue; } // larger than it said
    if (data) out.push({ name: name.split("/").pop(), data, size });
  }
  return out;
}
