import { getContext } from "@/lib/session";
import { toDocHtml, toCsv, hasTables } from "@/lib/gdocs";
import { filledFormatText } from "@/lib/outsideEdit";

// One format of a tender as a Word document (.doc that Word opens and edits; upload it back as .docx or .doc) or its
// tables as a spreadsheet (.csv that Excel opens; upload back as .xlsx or .csv). ?match=<id>&idx=<n>&as=word|excel
export async function GET(request) {
  const u = new URL(request.url);
  const { supabase, company } = await getContext();
  const { data: m } = await supabase.from("tender_matches").select("filled_formats, tenders(*)").eq("id", u.searchParams.get("match")).eq("company_id", company.id).maybeSingle();
  const p = (m?.filled_formats || [])[Number(u.searchParams.get("idx"))];
  if (!p) return new Response("Format not found", { status: 404 });
  const base = `${p.title}`.replace(/[^\w\- ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "format";
  const text = await filledFormatText({ supabase, companyId: company.id, tender: m.tenders, p });
  if (u.searchParams.get("as") === "excel") {
    if (!hasTables(text)) return new Response("This format has no table", { status: 400 });
    return new Response(`﻿${toCsv(text)}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}.csv"`, "cache-control": "no-store" } });
  }
  return new Response(toDocHtml(text, { title: p.title, word: true }), { headers: { "content-type": "application/msword; charset=utf-8", "content-disposition": `attachment; filename="${base}.doc"`, "cache-control": "no-store" } });
}
