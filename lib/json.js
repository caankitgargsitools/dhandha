// Reading an AI model's JSON answer (no server-only imports, so tests can use it).
export function parseJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  const body = start >= 0 ? t.slice(start, end + 1) : t;
  try { return JSON.parse(body); } catch (e) {
    // some models answer a list as one JSON object per line instead of one array: take them as an array
    try { return JSON.parse(`[${body.replace(/}\s*,?\s*\n\s*{/g, "},{")}]`); } catch { throw e; }
  }
}
