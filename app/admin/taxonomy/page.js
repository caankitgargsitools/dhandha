import { getAdminContext } from "@/lib/admin";
import { buildCatalog } from "@/lib/taxonomy";
import { reviewTaxonomy } from "./actions";

const KIND = { industry: "Industry", sub: "Sub-industry", service: "Service" };

// Industries, sub-industries and services that workspaces added themselves. Approve to make them searchable for
// everyone (edit the name and words first if needed), or reject to keep them private to that workspace.
export default async function TaxonomyReview({ searchParams }) {
  const sp = await searchParams;
  const status = ["pending", "approved", "rejected"].includes(sp?.s) ? sp.s : "pending";
  const { supabase } = await getAdminContext();
  const [{ data: rows }, { data: all }] = await Promise.all([
    supabase.from("taxonomy_custom").select("*, tenants(name)").eq("status", status).order("created_at", { ascending: false }).limit(200),
    supabase.from("taxonomy_custom").select("id, tenant_id, kind, parent, label, keywords, status"),
  ]);
  const { tree } = buildCatalog((all || []).map((r) => ({ ...r, mine: true })));
  const where = (parent) => {
    for (const i of tree) {
      if (i.id === parent) return i.label;
      const s = i.subs.find((x) => x.id === parent);
      if (s) return `${i.label} › ${s.label}`;
    }
    return parent || "—";
  };
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Industries & services added by workspaces</h1><p>Each works for the workspace that added it straight away. Approve to add it to everyone's search; edit the name or the words first if needed.</p></div>
        <div className="row" style={{ gap: 6 }}>{["pending", "approved", "rejected"].map((s) => <a key={s} href={`?s=${s}`} className={`btn sm ${s === status ? "" : "ghost"}`}>{s[0].toUpperCase() + s.slice(1)}</a>)}</div>
      </div>
      {!rows?.length && <div className="panel small muted">Nothing {status}.</div>}
      {(rows || []).map((r) => (
        <form key={r.id} action={reviewTaxonomy} className="panel stack-sm">
          <input type="hidden" name="id" value={r.id} />
          <div className="row between"><span><span className="chip info plain">{KIND[r.kind]}</span> <span className="small muted">under {where(r.parent)}</span></span><span className="tiny faint">{r.tenants?.name} · {new Date(r.created_at).toLocaleDateString("en-IN")}</span></div>
          <div className="form-grid">
            <div><label>Name</label><input name="label" defaultValue={r.label} /></div>
            {r.kind === "service" && <div><label>Words (comma separated; “+” for must-also words)</label><input name="keywords" defaultValue={(r.keywords || []).join(", ")} /></div>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            {status !== "approved" && <button name="status" value="approved" className="sm">Approve for everyone</button>}
            {status !== "rejected" && <button name="status" value="rejected" className="sm ghost">Reject</button>}
            {status !== "pending" && <button name="status" value="pending" className="sm ghost">Back to review</button>}
          </div>
        </form>
      ))}
    </div>
  );
}
