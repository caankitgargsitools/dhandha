import { getContext, fmtDate } from "@/lib/session";
import { metaReady } from "@/lib/meta";
import { disconnectMetaPage } from "../../actions";

const ERRORS = {
  state: "The sign-in took too long or came from another tab. Please try again.",
  denied: "Facebook access was not granted.", admin_only: "Only the workspace admin can connect Facebook.",
  not_configured: "Facebook connection is not switched on yet. Please ask Dhandha support.",
  no_pages: "No Facebook Pages were shared. Connect again and tick your business Page.",
  subscribe: "Facebook did not allow lead notifications for the Page. Check you are an admin of the Page.",
  save: "Could not save the connection.", meta: "Facebook returned an error. Please try again.",
};

export default async function FacebookSettings({ searchParams }) {
  const sp = await searchParams;
  const { supabase, tenant, company, isAdmin } = await getContext();
  const [{ data: pages }, { data: jobs }] = await Promise.all([
    supabase.from("meta_pages").select("page_id, page_name, ig_username, connected_at, revoked_at, company_id, companies(legal_name)").eq("tenant_id", tenant.id).order("connected_at", { ascending: false }),
    supabase.from("meta_lead_jobs").select("id, status, error, created_at, meta_pages!inner(tenant_id)").eq("meta_pages.tenant_id", tenant.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const live = (pages || []).filter((p) => !p.revoked_at);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Facebook &amp; Instagram leads</h1><p>When someone fills your Facebook or Instagram lead-ad form, they arrive in Leads within minutes, scored and with the form&apos;s answers, ready for a call or a sequence.</p></div></div>
      {sp?.connected && <p className="notice info small">{sp.connected} Page{sp.connected === "1" ? "" : "s"} connected. New lead-form entries will now arrive in Leads.</p>}
      {sp?.error && <p className="notice bad small">{ERRORS[sp.error] || "Something went wrong."}{sp.m ? ` (${sp.m})` : ""}</p>}
      <div className="panel stack-sm" style={{ maxWidth: 720 }}>
        <h3>Connected Pages</h3>
        {!live.length && <p className="small muted" style={{ margin: 0 }}>None yet.</p>}
        {live.map((p) => (
          <div key={p.page_id} className="row between small" style={{ padding: "6px 0", borderTop: "1px solid var(--line-soft)" }}>
            <span><strong>{p.page_name}</strong>{p.ig_username ? ` · Instagram @${p.ig_username}` : ""}<div className="tiny faint">Leads go to {p.companies?.legal_name} · since {fmtDate(p.connected_at)}</div></span>
            {isAdmin && <form action={disconnectMetaPage}><input type="hidden" name="page_id" value={p.page_id} /><button className="danger">Disconnect</button></form>}
          </div>
        ))}
        {isAdmin ? (
          <div><a className="btn gold" href="/api/meta/start" aria-disabled={!metaReady()}>{live.length ? "Connect more Pages" : "Connect Facebook"}</a></div>
        ) : <p className="small muted" style={{ margin: 0 }}>Only the workspace admin can connect Pages.</p>}
        {!metaReady() && <p className="small muted" style={{ margin: 0 }}>Facebook connection is being switched on for Dhandha.</p>}
        <p className="tiny faint" style={{ margin: 0 }}>Pages you tick on Facebook&apos;s screen are linked to the company open now ({company.legal_name}). Instagram lead ads come through the Facebook Page linked to your Instagram business account. Dhandha only reads lead-form entries; it never posts or reads messages.</p>
      </div>
      {(jobs || []).length > 0 && (
        <div className="panel" style={{ maxWidth: 720 }}>
          <h3>Recent form entries</h3>
          {jobs.map((j) => <div key={j.id} className="row between small" style={{ padding: "4px 0", borderTop: "1px solid var(--line-soft)" }}><span>{fmtDate(j.created_at)}{j.error ? ` · ${j.error}` : ""}</span><span className={`chip ${j.status === "done" ? "ok" : j.status === "failed" ? "bad" : "info"}`}>{j.status === "duplicate" ? "already a lead" : j.status}</span></div>)}
        </div>
      )}
    </div>
  );
}
