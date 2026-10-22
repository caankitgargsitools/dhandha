import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import FormState from "../../../FormState";
import { buyRecords } from "../../actions";
import TickAll from "./TickAll";

const PAGE = 50;

// One database: free search and filters with masked contacts; buy ticked records or all that match.
export default async function Database({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  const { data: set } = await supabase.from("data_sets").select("*").eq("id", id).eq("status", "live").maybeSingle();
  if (!set) notFound();
  const q = String(sp?.q || "").slice(0, 80);
  const facets = (set.fields || []).filter((f) => f.facet);
  const filters = Object.fromEntries(facets.map((f) => [f.key, String(sp?.[`f_${f.key}`] || "")]).filter(([, v]) => v));
  const page = Math.max(0, Number(sp?.page) || 0);
  const { data: res, error } = await supabase.rpc("data_search", { p_set: id, p_q: q, p_filters: filters, p_company: company.id, p_limit: PAGE, p_offset: page * PAGE });
  const rows = res?.rows || [];
  const total = res?.total || 0;
  const qs = (o) => new URLSearchParams(Object.entries({ q, ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [`f_${k}`, v])), ...o }).filter(([, v]) => v !== "" && v !== undefined)).toString();
  const price = Number(set.price_credits);
  return (
    <div className="stack">
      <Link href="/app/leads/databases" className="small">← All databases</Link>
      <div className="page-head"><div><h1>{set.name}</h1><p>{set.row_count.toLocaleString("en-IN")} records · {price} credit{price === 1 ? "" : "s"} per record · Source: {set.source_label}</p></div></div>
      <form className="panel row" style={{ gap: 8, alignItems: "end" }} action={`/app/leads/databases/${id}`}>
        <div style={{ flex: "2 1 220px" }}><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={q} placeholder="Name, company, role, anything" /></div>
        {facets.map((f) => (
          <div key={f.key} style={{ flex: "1 1 150px" }}>
            <label htmlFor={`f_${f.key}`}>{f.label}</label>
            <select id={`f_${f.key}`} name={`f_${f.key}`} defaultValue={filters[f.key] || ""}>
              <option value="">Any</option>
              {(set.facets?.[f.key] || []).map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
            </select>
          </div>
        ))}
        <button>Search</button>
      </form>
      {error && <p className="error small">{error.message}</p>}
      <div className="row between"><strong>{total > 10000 ? "10,000+" : total.toLocaleString("en-IN")} match{total === 1 ? "" : "es"}</strong><span className="tiny faint">Contacts are shown masked until bought.</span></div>
      {role !== "viewer" && total > 0 && (
        <FormState action={buyRecords} submit={`Buy all matching (up to the number below) · ${price} credit${price === 1 ? "" : "s"} each`}>
          <input type="hidden" name="set_id" value={id} /><input type="hidden" name="mode" value="all" /><input type="hidden" name="q" value={q} /><input type="hidden" name="filters" value={JSON.stringify(filters)} />
          <div style={{ maxWidth: 220 }}><label htmlFor="max">How many</label><input id="max" name="max" type="number" min="1" max="500" defaultValue={Math.min(total, 100)} /></div>
        </FormState>
      )}
      <FormState action={buyRecords} submit={`Buy ticked records · ${price} credit${price === 1 ? "" : "s"} each`}>
        <input type="hidden" name="set_id" value={id} />
        <TickAll />
        <div className="panel flush table-wrap">
          <table>
            <thead><tr><th /><th>Person</th><th>Company</th><th>Place</th><th>Contact</th></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={5} className="muted small" style={{ padding: 18 }}>No matches.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ width: 28 }}>{r.bought ? <span className="chip ok">Yours</span> : <input type="checkbox" name="rec" value={r.id} style={{ width: "auto" }} aria-label={`Buy ${r.name || r.company}`} />}</td>
                  <td><strong>{r.name || "—"}</strong><div className="tiny faint">{r.role}</div></td>
                  <td className="small">{r.company}<div className="tiny faint">{r.industry}</div>{r.extra && <div className="tiny faint">{Object.entries(r.extra).slice(0, 3).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</div>}</td>
                  <td className="small">{[r.city, r.state].filter(Boolean).join(", ")}</td>
                  <td className="tiny">{r.phone || "—"}<div>{r.email || ""}</div>{r.has_linkedin && <div>LinkedIn ✓</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormState>
      <div className="row" style={{ gap: 8 }}>
        {page > 0 && <Link className="btn ghost sm" href={`/app/leads/databases/${id}?${qs({ page: page - 1 })}`}>← Previous</Link>}
        {(page + 1) * PAGE < total && <Link className="btn ghost sm" href={`/app/leads/databases/${id}?${qs({ page: page + 1 })}`}>Next {PAGE} →</Link>}
      </div>
    </div>
  );
}
