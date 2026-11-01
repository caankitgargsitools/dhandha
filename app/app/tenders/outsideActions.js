"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { openInGoogle, pullFromGoogle, filledFormatText } from "@/lib/outsideEdit";
import { fromDocHtml, fromDocxXml, parseCsv, withSheetTables } from "@/lib/gdocs";
import { readXlsx, unzip } from "@/lib/xlsx";

const CAN = ["admin", "manager", "bid_preparer"];

async function load(matchId) {
  const ctx = await getContext();
  if (!CAN.includes(ctx.role)) throw new Error("Only admins, managers and bid preparers can edit formats.");
  const { data: m } = await ctx.supabase.from("tender_matches").select("id, filled_formats, tenders(*)").eq("id", matchId).eq("company_id", ctx.company.id).maybeSingle();
  if (!m) throw new Error("Tender not found.");
  return { ...ctx, m, plan: m.filled_formats || [] };
}
const save = async (supabase, matchId, plan) => {
  const { error } = await supabase.from("tender_matches").update({ filled_formats: plan }).eq("id", matchId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/tenders/${matchId}/assistant`);
};

// "Open in Google Docs / Sheets": made once in the workspace's Drive, then the same file opens each time.
export async function openOutside({ matchId, idx, kind }) {
  try {
    const { supabase, tenant, company, m, plan } = await load(matchId);
    const r = await openInGoogle({ supabase, tenant, company, plan, idx: Number(idx), kind: kind === "sheet" ? "sheet" : "doc", title: m.tenders?.title, tender: m.tenders });
    if (r.plan !== plan) await save(supabase, matchId, r.plan);
    return { ok: true, url: r.url };
  } catch (e) { return { error: e.message }; }
}

// Whatever was saved in Google comes back (called when the person returns to the page, and by "Bring back now").
export async function syncOutside({ matchId }) {
  try {
    const { supabase, tenant, company, plan, m } = await load(matchId);
    const r = await pullFromGoogle({ supabase, tenant, company, plan, tender: m.tenders });
    if (r.changed) await save(supabase, matchId, r.plan);
    return { ok: true, changed: r.changed, errors: r.errors };
  } catch (e) { return { error: e.message }; }
}

// A filled Word / Excel / CSV file uploaded back.
export async function uploadFilled(formData) {
  try {
    const matchId = String(formData.get("match_id"));
    const idx = Number(formData.get("idx"));
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function" || !file.size) return { error: "Choose the filled file." };
    if (file.size > 3.5 * 1024 * 1024) return { error: "That file is over 3.5 MB." }; // server actions take at most 4 MB
    const { supabase, plan, company, m } = await load(matchId);
    const p = plan[idx];
    if (!p) return { error: "Format not found." };
    const name = String(file.name || "").toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    let text;
    if (name.endsWith(".docx")) {
      const files = unzip(buf);
      if (!files["word/document.xml"]) return { error: "That .docx has no document inside." };
      text = fromDocxXml(files["word/document.xml"]());
    } else if (/\.(doc|html?)$/.test(name)) {
      const s = buf.toString("utf8");
      if (!/<html|<body|<p[ >]/i.test(s)) return { error: "This is an old binary .doc. In Word choose File → Save as → Word Document (.docx) and upload that." };
      text = fromDocHtml(s);
    } else if (name.endsWith(".xlsx")) text = withSheetTables(await filledFormatText({ supabase, companyId: company.id, tender: m.tenders, p }), readXlsx(buf, { keepGaps: true }));
    else if (name.endsWith(".csv")) text = withSheetTables(await filledFormatText({ supabase, companyId: company.id, tender: m.tenders, p }), parseCsv(buf.toString("utf8")));
    else if (name.endsWith(".txt")) text = buf.toString("utf8");
    else return { error: "Upload a .docx, .xlsx, .csv or the .doc downloaded from here." };
    if (!String(text).trim()) return { error: "The file looks empty." };
    const next = plan.slice();
    next[idx] = { ...p, edited_text: String(text).slice(0, 60000), reviewed: true, outside: { via: name.split(".").pop(), at: new Date().toISOString() } };
    await save(supabase, matchId, next);
    const left = (String(text).match(/\[TO BE FILLED:/g) || []).length;
    return { ok: true, message: `“${p.title}” filled from your file${left ? ` — ${left} blank${left === 1 ? "" : "s"} still empty` : ""}.` };
  } catch (e) { return { error: e.message }; }
}
