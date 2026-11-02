import Link from "next/link";
import { getContext } from "@/lib/session";
import { loadCatalog } from "@/lib/catalog";
import { firmSectors, sectorRx } from "@/lib/credentials";
import { masterPlan, masterStatus, nextItem, progress, BUYERS } from "@/lib/masterPlan";
import { FIELDS, lastFys } from "@/lib/masters";
import FormState from "../../FormState";
import { saveMasterItem } from "./actions";
import { saveCredential } from "../credentials/actions";

export const dynamic = "force-dynamic";

// The tender-ready checklist (owner's "intelligent master page"): from the firm's services and the kinds of buyers it
// sells to, everything its tenders ask for — company details, documents, licences and registrations, money, people and
// works — with the next missing one asked right here, one at a time. Uploads go to Vault → Documents, which reads them
// and fills the rest of the Vault on its own.
export default async function Masters({ searchParams }) {
  const sp = await searchParams;
  const { supabase, tenant, company, role } = await getContext();
  const [{ data: c }, { data: pref }, { index }, { data: facts }, { data: docs }, { count: people }, { count: works }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("tender_preferences").select("services").eq("company_id", company.id).maybeSingle(),
    loadCatalog(supabase, tenant.id),
    supabase.from("company_facts").select("key, period, value").eq("company_id", company.id),
    supabase.from("documents").select("type_code, valid_until").eq("company_id", company.id).eq("status", "active"),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("experience_items").select("id", { count: "exact", head: true }).eq("company_id", company.id),
  ]);
  const sectors = firmSectors((pref?.services || []).map((id) => index[id]).filter(Boolean));
  const { data: stats } = sectors.length ? await supabase.rpc("credential_stats", { p_rx: sectorRx(sectors) }) : { data: [] };
  let buyers = [];
  try { buyers = JSON.parse((facts || []).find((f) => f.key === "profile.buyers")?.value || "[]"); } catch {}
  const msme = ["micro", "small"].includes(c?.msme_category) || /^UDYAM/i.test(c?.udyam_no || "");
  const brands = (facts || []).filter((f) => /^(oem|supply)\./.test(f.key)).length;
  const items = masterPlan({ sectors, buyers, stats: stats || [], msme });
  const status = masterStatus(items, { company: c, docs: docs || [], facts: facts || [], people: people || 0, works: works || 0, buyers, brands });
  const p = progress(status);
  const asked = sp?.item ? status.find((s) => s.id === sp.item) : null;
  const next = asked || nextItem(status);
  const edit = role !== "viewer";
  const groups = [...new Set(status.map((s) => s.group))];
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Tender-ready checklist</h1>
        <p>Everything tenders for your kind of work ask for, from what you do and who you sell to. Answer once — every format, condition and checklist in every tender uses it. Upload a document and Dhandha reads it and fills the rest.</p></div></div>
      {!sectors.length && <div className="notice small"><span>Choose your services in <Link href="/app/tenders/preferences">What we do</Link> — the checklist follows your kind of work.</span></div>}

      <div className="panel stack-sm">
        <div className="row between"><strong>{p.done} of {p.total} ready</strong><span className={`chip ${pct === 100 ? "ok" : pct >= 60 ? "info" : "warn"}`}>{pct}%</span></div>
        <div style={{ height: 8, background: "var(--line-soft)", borderRadius: 9 }}><div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)", borderRadius: 9 }} /></div>
      </div>

      {next && edit && (
        <div className="panel stack-sm" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div className="tiny faint">{next.done ? "Update" : "Next"} · {next.group}</div>
          <strong>{next.kind === "company" ? FIELDS[next.field]?.q || next.label : next.label}</strong>
          {next.why && <div className="tiny faint">{next.why}{next.note ? ` · ${next.note}` : ""}</div>}
          <Answer item={next} company={c} facts={facts || []} buyers={buyers} />
        </div>
      )}
      {!next && <div className="notice small"><span>✓ Everything on the checklist is in your Vault. Keep documents current — you get an alert before any expires.</span></div>}

      {groups.map((g) => (
        <div key={g} className="panel stack-sm">
          <strong>{g}</strong>
          {status.filter((s) => s.group === g).map((s) => (
            <div key={s.id} className="row between" style={{ gap: 10, borderTop: "1px solid var(--line-soft)", paddingTop: 6 }}>
              <span className="small"><span style={{ color: s.done ? "var(--leaf)" : "var(--marigold)", fontWeight: 700 }}>{s.done ? "✓" : "○"}</span> {s.label}{s.note && <span className="tiny faint"> · {s.note}</span>}</span>
              {edit && <Link className="small" href={`/app/vault/masters?item=${encodeURIComponent(s.id)}`} scroll={false}>{s.done ? "Change" : "Do it"}</Link>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Answer({ item, company, facts, buyers }) {
  const hidden = (k, v) => <input type="hidden" name={k} value={v} />;
  if (item.kind === "buyers") return (
    <FormState action={saveMasterItem} submit="Save">
      {hidden("kind", "buyers")}
      <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>{BUYERS.map((b) => <label key={b.key} className="row small" style={{ gap: 6 }}><input type="checkbox" name="buyers" value={b.key} defaultChecked={buyers.includes(b.key)} /> {b.label}</label>)}</div>
    </FormState>
  );
  if (item.kind === "company") {
    const def = FIELDS[item.field] || {};
    return (
      <FormState action={saveMasterItem} submit="Save" className="row">
        {hidden("kind", "company")}{hidden("field", item.field)}
        {def.options ? (
          <select name="value" defaultValue={company?.[item.field] || ""} aria-label={def.label}><option value="" disabled>Choose…</option>{Object.entries(def.options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        ) : def.long ? <textarea name="value" rows={2} defaultValue={company?.[item.field] || ""} aria-label={def.label} style={{ minWidth: 320 }} />
          : <input name="value" type={def.type === "date" ? "date" : "text"} placeholder={def.hint || ""} defaultValue={company?.[item.field] || ""} aria-label={def.label} style={{ minWidth: 260 }} />}
      </FormState>
    );
  }
  if (item.kind === "turnover") {
    const have = Object.fromEntries(facts.filter((f) => f.key === "fin.turnover").map((f) => [f.period, f.value]));
    return (
      <FormState action={saveMasterItem} submit="Save turnover">
        {hidden("kind", "turnover")}
        <div className="form-grid">{lastFys().map((fy) => <div key={fy}><label htmlFor={`fy-${fy}`}>{fy} (₹, audited)</label><input id={`fy-${fy}`} name={`fy:${fy}`} inputMode="numeric" defaultValue={have[fy] || ""} /></div>)}</div>
      </FormState>
    );
  }
  if (item.kind === "fact") {
    const cur = facts.find((f) => f.key === item.key)?.value || "";
    return (
      <FormState action={saveMasterItem} submit="Save" className="row">
        {hidden("kind", "fact")}{hidden("key", item.key)}
        {item.type === "yesno" ? <select name="value" defaultValue={cur} aria-label={item.label}><option value="" disabled>Choose…</option><option value="yes">Yes</option><option value="no">No</option></select>
          : <input name="value" defaultValue={cur} inputMode={item.key === "fin.net_worth" ? "numeric" : undefined} placeholder={item.key === "fin.net_worth" ? "₹ as per latest balance sheet" : ""} aria-label={item.label} style={{ minWidth: 260 }} />}
      </FormState>
    );
  }
  if (item.kind === "cred") {
    const cur = facts.find((f) => f.key === `cred.${item.key}`)?.value || "";
    return (
      <FormState action={saveCredential} submit="Save" className="row">
        {hidden("key", item.key)}
        {item.type === "yesno" ? <select name="value" defaultValue={cur} aria-label={item.label}><option value="" disabled>Choose…</option><option value="yes">Yes</option><option value="no">No</option></select>
          : <input name="value" defaultValue={cur} inputMode={item.type === "number" ? "numeric" : undefined} aria-label={item.label} style={{ width: item.type === "number" ? 100 : 260 }} />}
      </FormState>
    );
  }
  if (item.kind === "doc") return <div><Link className="btn" href={`/app/vault/documents?type=${encodeURIComponent(item.code)}#add`}>Upload {item.label.toLowerCase()}</Link> <span className="tiny faint">Dhandha reads it and fills your Vault.</span></div>;
  const to = { people: ["/app/vault/people", "Add key people"], works: ["/app/vault/experience", "Add completed works"], brands: ["/app/vault/brands", "Add brands & supplies"] }[item.kind];
  return to ? <Link className="btn" href={to[0]}>{to[1]}</Link> : null;
}
