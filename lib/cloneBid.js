// Clone from a past bid (brief §3.8): start a new bid from a similar one — same format choices, edited texts and cost
// sheet — with the old tender's title, reference and department swapped for the new one's, and nothing that belongs
// to the old tender only (Google / outside copies, review marks, the quoted price). Pure and tested.

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function swapRefs(text, from = {}, to = {}) {
  let t = String(text || "");
  for (const k of ["tender_ref", "title", "authority", "department"]) {
    const a = String(from[k] || "").trim(), b = String(to[k] || "").trim();
    if (a.length >= 4 && b && a !== b) t = t.replace(new RegExp(esc(a), "gi"), b);
  }
  return t;
}

// formats of the past bid → the new plan (matched by title to the new tender's formats when it has a reading)
export function cloneFormats(oldPlan = [], fromTender = {}, toTender = {}) {
  return (oldPlan || []).filter((f) => f && f.kind !== "skip").map((f) => {
    const { gdoc, outside, reviewed, ...rest } = f; // eslint-disable-line no-unused-vars
    const out = { ...rest, cloned: true };
    for (const k of ["edited_text", "filled_text"]) if (out[k]) out[k] = swapRefs(out[k], fromTender, toTender);
    return out;
  });
}

// how alike two tenders are, to suggest the best past bid first (title words, same authority, same kind of work)
export function likeness(a = {}, b = {}) {
  const w = (s) => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((x) => x.length > 3));
  const A = w(a.title), B = w(b.title);
  let hit = 0; for (const x of A) if (B.has(x)) hit++;
  const words = A.size && B.size ? hit / Math.min(A.size, B.size) : 0;
  return Math.round((words * 70 + (a.authority && a.authority === b.authority ? 20 : 0) + (a.industry_pack && a.industry_pack === b.industry_pack ? 10 : 0)));
}
