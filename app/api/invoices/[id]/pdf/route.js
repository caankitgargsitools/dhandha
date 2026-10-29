import { getContext } from "@/lib/session";
import { buildQuotePdf } from "@/lib/quotePdf";

// A tax invoice as a PDF on the company's letterhead (signed-in members of the workspace only).
export async function GET(_request, { params }) {
  const { id } = await params;
  const { supabase, company } = await getContext();
  const [{ data: inv }, { data: c }, { data: lh }, { data: st }] = await Promise.all([
    supabase.from("sales_invoices").select("*").eq("id", id).eq("company_id", company.id).maybeSingle(),
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("brand_assets").select("storage_path, meta").eq("company_id", company.id).eq("kind", "letterhead").maybeSingle(),
    supabase.from("invoice_settings").select("upi_id").eq("company_id", company.id).maybeSingle(),
  ]);
  if (!inv) return new Response("not found", { status: 404 });
  let letterheadBytes = null;
  if (lh?.storage_path) {
    const { data } = await supabase.storage.from("brand").download(lh.storage_path);
    if (data) letterheadBytes = new Uint8Array(await data.arrayBuffer());
  }
  const type = lh?.storage_path?.endsWith(".pdf") ? "pdf" : lh?.storage_path?.endsWith(".png") ? "png" : "jpg";
  const bytes = await buildQuotePdf({ quote: inv, company: c, letterheadBytes, letterheadType: type, margins: lh?.meta, kind: "invoice", upi: st?.upi_id });
  return new Response(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${(inv.number || "draft-invoice").replace(/\//g, "-")}.pdf"` } });
}
