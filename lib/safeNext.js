// Where to go after sign-in / 2FA: only a path on this site under /app or /admin, never another address.
// Pure and tested. Allows a short query string (?item=…&tab=…), nothing that could start a new host ("//", "\\", ":").
export function safeNext(v, fallback = "/app") {
  const s = String(v ?? "");
  if (s.length > 300) return fallback;
  return /^\/(app|admin)(\/[\w\-./]*)?(\?[\w\-=&%.+]*)?$/.test(s) && !s.includes("//") && !s.includes("..") ? s : fallback;
}
