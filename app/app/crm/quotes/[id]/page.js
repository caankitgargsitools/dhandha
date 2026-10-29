import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getContext } from "@/lib/session";
import Editor from "./Editor";

export const metadata = { title: "Quotation" };

export default async function QuotePage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  const isNew = id === "new";
  const [{ data: q }, { data: c }, { data: lead }, h] = await Promise.all([
    isNew ? { data: null } : supabase.from("quotes").select("*").eq("id", id).eq("company_id", company.id).maybeSingle(),
    supabase.from("companies").select("gstin, state, legal_name").eq("id", company.id).single(),
    sp?.lead ? supabase.from("leads").select("id, name, contact_person, address, city, state, gstin, email, phone").eq("id", sp.lead).eq("company_id", company.id).maybeSingle() : { data: null },
    headers(),
  ]);
  if (!isNew && !q) notFound();
  const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const initial = q || {
    client_name: lead?.name || "", client_contact: lead?.contact_person || "", client_address: [lead?.address, lead?.city].filter(Boolean).join(", "),
    client_gstin: lead?.gstin || "", client_state: lead?.state || "", client_email: lead?.email || "", client_phone: lead?.phone || "", lead_id: lead?.id || "",
    subject: "", lines: [{ desc: "", hsn: "", qty: 1, unit: "", rate: 0, gst: 18 }], discount: 0,
    terms: "1. Prices are exclusive of out-of-pocket expenses, if any.\n2. 50% advance with the order, balance on completion.\n3. GST as applicable.", valid_until: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), status: "draft",
  };
  return (
    <div className="stack">
      <div><Link href="/app/crm/quotes" className="small">← Quotations</Link><h1>{q ? `Quotation ${q.number}` : "New quotation"}</h1></div>
      {q?.status === "accepted" && <div className="notice small">Accepted by the client. <a href={`/app/crm/invoices/new?quote=${q.id}`}>Make the invoice from it</a>.</div>}
      <Editor id={q?.id || null} initial={initial} seller={c} origin={origin} canEdit={!["viewer", "field"].includes(role)} />
    </div>
  );
}
