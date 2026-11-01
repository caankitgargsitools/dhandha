import "server-only";
import { companyDrive } from "./drive";
import { driveReady, createConverted, fileStamp, exportFile } from "./google";
import { toDocHtml, fromDocHtml, toCsv, parseCsv, withSheetTables, hasTables } from "./gdocs";
import { fillPlaceholders } from "./masters";

// Editing a format outside Dhandha (Google Docs / Sheets in the workspace's own Drive). The format's plan entry keeps
// `gdoc: { id, kind: "doc" | "sheet", url, modified }`; whatever is saved there comes back as the format's edited text
// whenever the person returns to the assistant, before a bid file is made, or on "Bring back now".
export const formatText = (p) => p.edited_text || p.filled_text || p.text || "";

// The text as the person sees it in the assistant: what they edited, else the filled text with the Vault's answers in.
export async function filledFormatText({ supabase, companyId, tender, p }) {
  if (p.edited_text) return p.edited_text;
  const src = p.filled_text || p.text || "";
  if (!/\[TO BE FILLED:/i.test(src)) return src;
  const [{ data: c }, { data: facts }, { data: people }, { data: works }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).single(),
    supabase.from("company_facts").select("key, period, value, unit").eq("company_id", companyId),
    supabase.from("people").select("*").eq("company_id", companyId),
    supabase.from("experience_items").select("*").eq("company_id", companyId),
  ]);
  return fillPlaceholders(src, facts || [], { people: people || [], works: works || [], company: c || {}, tender: tender || {} });
}

export async function openInGoogle({ supabase, tenant, company, plan, idx, kind, title, tender }) {
  if (!driveReady()) throw new Error("Google Docs is not switched on for this site yet — use Download for Word / Excel meanwhile.");
  const p = plan[idx];
  if (!p) throw new Error("Format not found.");
  if (kind === "sheet" && !hasTables(formatText(p))) throw new Error("This format has no table to fill in a sheet — open it in Google Docs.");
  const drive = await companyDrive({ supabase, tenant, company });
  if (p.gdoc?.id && p.gdoc.kind === kind) {
    const s = await fileStamp(drive.access, p.gdoc.id).catch(() => null);
    if (s && !s.trashed) return { plan, url: p.gdoc.url || s.webViewLink };
  }
  const now = await filledFormatText({ supabase, companyId: company.id, tender, p });
  const content = kind === "sheet" ? toCsv(now) : toDocHtml(now, { title: p.title });
  const f = await createConverted(drive.access, { name: `${String(title || "Tender").slice(0, 60)} — ${p.title}`.slice(0, 120), kind, content, parentId: drive.folderId });
  const next = plan.slice();
  next[idx] = { ...p, gdoc: { id: f.id, kind, url: f.webViewLink, modified: f.modifiedTime, at: new Date().toISOString() } };
  return { plan: next, url: f.webViewLink };
}

// Brings back every linked format changed since it was last brought back. Returns the new plan and how many changed.
export async function pullFromGoogle({ supabase, tenant, company, plan, tender }) {
  const linked = plan.map((p, i) => [p, i]).filter(([p]) => p.gdoc?.id);
  if (!linked.length || !driveReady()) return { plan, changed: 0, errors: [] };
  const drive = await companyDrive({ supabase, tenant, company });
  const next = plan.slice();
  let changed = 0;
  const errors = [];
  await Promise.all(linked.map(async ([p, i]) => {
    try {
      const s = await fileStamp(drive.access, p.gdoc.id);
      if (s.trashed) { next[i] = { ...p, gdoc: { ...p.gdoc, trashed: true } }; return; }
      if (p.gdoc.modified && s.modifiedTime <= p.gdoc.modified) return;
      const text = p.gdoc.kind === "sheet"
        ? withSheetTables(await filledFormatText({ supabase, companyId: company.id, tender, p }), parseCsv(await exportFile(drive.access, p.gdoc.id, "text/csv")))
        : fromDocHtml(await exportFile(drive.access, p.gdoc.id, "text/html"));
      if (!text.trim()) return;
      next[i] = { ...p, edited_text: text.slice(0, 60000), reviewed: true, gdoc: { ...p.gdoc, modified: s.modifiedTime, pulled: new Date().toISOString() } };
      changed++;
    } catch (e) { errors.push(`${p.title}: ${e.message}`); }
  }));
  return { plan: next, changed, errors };
}
