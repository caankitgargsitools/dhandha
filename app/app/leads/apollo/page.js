import { getContext } from "@/lib/session";
import { apolloSearch, mapApolloPerson } from "@/lib/connectors";
import { listField } from "@/lib/leads";
import FormState from "../../FormState";
import FoundList from "../FoundList";
import { saveApolloKey, disconnectApollo } from "../actions";

// Apollo: decision-makers by job title, place and keywords, using the workspace's own Apollo account.
export default async function Apollo({ searchParams }) {
  const sp = await searchParams;
  const { supabase, tenant, company, role, isAdmin } = await getContext();
  const { data: conn } = await supabase.from("lead_connectors").select("apollo_connected_at").eq("tenant_id", tenant.id).maybeSingle();
  const connected = !!conn?.apollo_connected_at;
  const titles = listField(sp?.titles).slice(0, 10), places = listField(sp?.places).slice(0, 10), keywords = String(sp?.keywords || "").slice(0, 100);
  let res = null;
  if (connected && (titles.length || places.length || keywords)) {
    const { data: key } = await supabase.rpc("apollo_key", { p_tenant: tenant.id });
    res = key ? await apolloSearch({ key, titles, locations: places, keywords, page: Number(sp?.page) || 1 }) : { error: "Could not read the Apollo key." };
  }
  const rows = (res?.people || []).map(mapApolloPerson).filter((r) => r.name);
  const page = Number(sp?.page) || 1;
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <div className="page-head"><div><h1>Apollo</h1><p>Find the people who decide — by job title, place and industry — and add their companies to {company.legal_name}&apos;s leads. Uses your own Apollo account; no Dhandha credits.</p></div></div>
      {!connected ? (
        <div className="panel stack-sm" style={{ maxWidth: 640 }}>
          <h3 style={{ margin: 0 }}>Connect your Apollo account</h3>
          <p className="small muted" style={{ margin: 0 }}>In Apollo: <strong>Settings → Integrations → API → Create new key</strong> (needs an Apollo plan with API access). Paste it here; it is stored encrypted and only used for your searches.</p>
          {isAdmin ? (
            <FormState action={saveApolloKey} submit="Connect Apollo">
              <input name="key" type="password" autoComplete="off" required placeholder="Apollo API key" aria-label="Apollo API key" />
            </FormState>
          ) : <p className="small">Ask your workspace admin to connect Apollo.</p>}
        </div>
      ) : (
        <>
          <form className="panel row" style={{ gap: 8, alignItems: "end" }} action="/app/leads/apollo">
            <div style={{ flex: "2 1 220px" }}><label htmlFor="titles">Job titles</label><input id="titles" name="titles" defaultValue={titles.join(", ")} placeholder="e.g. CFO, Finance Head, Procurement Manager" /></div>
            <div style={{ flex: "1 1 160px" }}><label htmlFor="places">Places</label><input id="places" name="places" defaultValue={places.join(", ")} placeholder="e.g. Gurugram, Haryana" /></div>
            <div style={{ flex: "1 1 160px" }}><label htmlFor="keywords">Industry / keywords</label><input id="keywords" name="keywords" defaultValue={keywords} placeholder="e.g. construction" /></div>
            <button>Search</button>
          </form>
          {res?.error && <p className="error small">{res.error}</p>}
          {res && !res.error && !rows.length && <p className="muted small">Nobody found. Try fewer filters.</p>}
          {res?.total ? <p className="small muted" style={{ margin: 0 }}>{res.total.toLocaleString("en-IN")} people match; showing 25 at a time. Emails and phones are revealed in Apollo (uses your Apollo credits).</p> : null}
          {role !== "viewer" && <FoundList source="apollo" rows={rows} />}
          {rows.length === 25 && <a className="btn ghost sm" href={`/app/leads/apollo?${new URLSearchParams({ titles: titles.join(","), places: places.join(","), keywords, page: page + 1 })}`}>Next 25</a>}
          {isAdmin && <form action={disconnectApollo}><button className="ghost sm">Disconnect Apollo</button></form>}
        </>
      )}
    </div>
  );
}
