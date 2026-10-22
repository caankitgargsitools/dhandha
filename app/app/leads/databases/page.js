import Link from "next/link";
import { getContext } from "@/lib/session";

// Data marketplace: the databases a company can search and buy contacts from.
export default async function Databases() {
  const { supabase, company } = await getContext();
  const [{ data: sets }, { data: mine }] = await Promise.all([
    supabase.from("data_sets").select("id, name, source_label, audience, lawful_basis, price_credits, row_count, fields").eq("status", "live").order("created_at", { ascending: false }),
    supabase.from("data_purchases").select("set_id").eq("company_id", company.id),
  ]);
  const bought = (id) => (mine || []).filter((m) => m.set_id === id).length;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Buy data</h1><p>Ready contact databases. Search and filter for free; pay only for the records you take — they go straight into your leads.</p></div></div>
      {!sets?.length && <div className="panel muted small">No databases are available yet.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {(sets || []).map((s) => (
          <Link key={s.id} href={`/app/leads/databases/${s.id}`} className="panel stack-sm" style={{ color: "inherit", textDecoration: "none" }}>
            <strong>{s.name}</strong>
            <div className="small muted">{s.row_count.toLocaleString("en-IN")} records · {s.audience === "consumer" ? "consumers (consented)" : "businesses"}</div>
            <div className="tiny faint">Filter by: {(s.fields || []).filter((f) => f.facet).map((f) => f.label).join(", ") || "search only"}</div>
            <div className="row" style={{ gap: 6 }}><span className="chip info">{s.price_credits} credit{Number(s.price_credits) === 1 ? "" : "s"} / record</span>{bought(s.id) > 0 && <span className="chip ok">{bought(s.id)} bought</span>}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
