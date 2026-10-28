import { getContext } from "@/lib/session";
import { buildQuotePdf } from "@/lib/quotePdf";

// The quotation as a PDF on the company's letterhead (signed-in members of the workspace only).
export async function GET(_request, { params }) {
  const { id } = await params;
  const { supabase, company } = await getContext();
  const [{ data: quote }, { data: c }, { data: lh }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).eq("company_id", company.id).maybeSingle(),
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("brand_assets").select("storage_path, meta").eq("company_id", company.id).eq("kind", "letterhead").maybeSingle(),
  ]);
  if (!quote) return new Response("not found", { status: 404 });
  let letterheadBytes = null;
  if (lh?.storage_path) {
    const { data } = await supabase.storage.from("brand").download(lh.storage_path);
    if (data) letterheadBytes = new Uint8Array(await data.arrayBuffer());
  }
  const type = lh?.storage_path?.endsWith(".pdf") ? "pdf" : lh?.storage_path?.endsWith(".png") ? "png" : "jpg";
  const bytes = await buildQuotePdf({ quote, company: c, letterheadBytes, letterheadType: type, margins: lh?.meta });
  return new Response(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${quote.number.replace(/\//g, "-")}.pdf"` } });
}
