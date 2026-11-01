import Link from "next/link";
import { getContext } from "@/lib/session";
import { loadCatalog } from "@/lib/catalog";
import { firmSectors, questionsFor, sectorRx, CREDENTIALS } from "@/lib/credentials";
import { SECTORS } from "@/lib/formatHarvest";
import FormState from "../../FormState";
import { saveCredential } from "./actions";

export const dynamic = "force-dynamic";

// Licences, registrations, empanelments and counts that tenders in the firm's industries ask for — chosen from its
// services (What we do), ordered by how often fetched tenders ask them (SQL credential_stats), asked once.
export default async function Credentials() {
  const { supabase, company, tenant, role } = await getContext();
  const [{ data: pref }, { index }, { data: facts }] = await Promise.all([
    supabase.from("tender_preferences").select("services").eq("company_id", company.id).maybeSingle(),
    loadCatalog(supabase, tenant.id),
    supabase.from("company_facts").select("key, value").eq("company_id", company.id).like("key", "cred.%"),
  ]);
  const sectors = firmSectors((pref?.services || []).map((id) => index[id]).filter(Boolean));
  const { data: stats } = await supabase.rpc("credential_stats", { p_rx: sectorRx(sectors) });
  const qs = questionsFor(sectors, stats || []);
  const others = CREDENTIALS.filter((c) => !qs.some((q) => q.key === c.key));
  const have = Object.fromEntries((facts || []).map((f) => [f.key.slice(5), f.value]));
  const done = qs.filter((q) => have[q.key] != null).length;
  const edit = role !== "viewer";

  const Q = ({ c }) => (
    <div className="row between" style={{ gap: 10, padding: "8px 0", borderTop: "1px solid var(--line-soft)", alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px" }}><div className="small"><strong>{c.ask}</strong></div>
        <div className="tiny faint">{c.asked ? `Asked in ${c.asked} fetched tender${c.asked === 1 ? "" : "s"} in your industries` : "Often asked in your industries"}{have[c.key] != null && <> · <span className="chip ok">{c.kind === "yesno" ? (have[c.key] === "yes" ? "Yes" : "No") : have[c.key]}</span></>}</div></div>
      {edit && (
        <FormState action={saveCredential} submit={have[c.key] != null ? "Update" : "Save"} className="row" buttonClass="sm">
          <input type="hidden" name="key" value={c.key} />
          {c.kind === "yesno" ? (
            <select name="value" defaultValue={have[c.key] || ""} aria-label={c.label}><option value="" disabled>Choose…</option><option value="yes">Yes</option><option value="no">No</option></select>
          ) : <input name="value" defaultValue={have[c.key] || ""} inputMode={c.kind === "number" ? "numeric" : undefined} aria-label={c.label} style={{ width: c.kind === "number" ? 90 : 220 }} />}
        </FormState>
      )}
    </div>
  );

  return (
    <div className="stack">
      <div><h1>Credentials</h1>
        <p className="muted" style={{ margin: 0 }}>Licences, registrations, empanelments and team numbers that tenders in your industries ask for. Answer once; every tender that asks is checked against them. The list follows what Dhandha reads in fetched tenders, so the most-asked come first.</p></div>
      {!sectors.length ? (
        <div className="notice small"><span>Choose your services in <Link href="/app/tenders/preferences">What we do</Link> first — the questions depend on your industry.</span></div>
      ) : (
        <div className="panel stack-sm">
          <div className="row between"><strong>For {sectors.map((s) => SECTORS[s]?.label || s).join(", ")}</strong><span className={`chip ${done === qs.length ? "ok" : "warn"}`}>{done} of {qs.length} answered</span></div>
          {qs.map((c) => <Q key={c.key} c={c} />)}
        </div>
      )}
      {others.length > 0 && (
        <details className="panel">
          <summary style={{ cursor: "pointer" }}><strong>Questions for other industries</strong> <span className="faint small">({others.length})</span></summary>
          {others.map((c) => <Q key={c.key} c={{ ...c, asked: 0 }} />)}
        </details>
      )}
    </div>
  );
}
