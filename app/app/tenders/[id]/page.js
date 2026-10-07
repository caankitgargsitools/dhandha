import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, daysLeft, lakh, fmtDate } from "@/lib/session";
import { requiredDocs } from "@/lib/bidpack";
import { ScoreRing } from "@/components/Charts";
import Icon from "@/components/Icon";
import BidPackForm from "../BidPackForm";
import { ago } from "@/lib/tickets";

const PROFILE_NEEDED = [["legal_name", "Legal name"], ["pan", "PAN"], ["gstin", "GSTIN"], ["registered_address", "Registered address"], ["signatory_name", "Signatory name"], ["signatory_designation", "Signatory designation"], ["bank_account", "Bank account"], ["bank_ifsc", "IFSC"]];

export default async function TenderDetail({ params }) {
  const { id } = await params;
  const { supabase, company, role, isAdmin, has2fa } = await getContext();
  const { data: m } = await supabase.from("tender_matches").select("*, tenders(*)").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!m) notFound();
  const t = m.tenders;
  const [{ data: c }, { data: docs }, { data: types }, { data: facts }, { data: brand }, { data: packs }, { data: changes }, { data: wallet }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("documents").select("type_code, number, period, valid_until, title, drive_url").eq("company_id", company.id).eq("status", "active"),
    supabase.from("document_types").select("code, name"),
    supabase.from("company_facts").select("key, period").eq("company_id", company.id).eq("key", "fin.turnover"),
    supabase.from("brand_assets").select("kind").eq("company_id", company.id),
    supabase.from("bid_packs").select("*").eq("match_id", m.id).order("created_at", { ascending: false }),
    supabase.from("tender_changes").select("*").eq("tender_id", t.id).order("seen_at", { ascending: false }),
    supabase.from("wallets").select("balance").eq("tenant_id", m.tenant_id).maybeSingle(),
  ]);
  const msme = ["micro", "small"].includes(c.msme_category) && c.udyam_no;
  const due = new Date(t.due_at);
  const checklist = requiredDocs(t.industry_pack, msme).map((code) => {
    const d = (docs || []).filter((x) => x.type_code === code).sort((a, b) => new Date(b.valid_until || "2999-01-01") - new Date(a.valid_until || "2999-01-01"))[0];
    const name = (types || []).find((x) => x.code === code)?.name || code;
    const state = !d ? "missing" : d.valid_until && new Date(d.valid_until) < due ? "expiring" : "ok";
    return { code, name, d, state };
  });
  const gaps = [
    ...PROFILE_NEEDED.filter(([k]) => !c[k]).map(([, l]) => ({ label: l, href: "/app/vault/profile" })),
    ...((facts || []).length < 3 ? [{ label: "Turnover for the last 3 years", href: "/app/vault/facts" }] : []),
  ];
  const kinds = new Set((brand || []).map((b) => b.kind));
  const signed = await Promise.all((packs || []).map(async (p) => ({ ...p, url: (await supabase.storage.from("bids").createSignedUrl(p.storage_path, 3600)).data?.signedUrl })));
  const left = daysLeft(t.due_at);
  const ready = checklist.filter((x) => x.state === "ok").length;
  const canMake = ["admin", "manager", "bid_preparer"].includes(role);

  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 16 }}>
          <ScoreRing score={m.score} size={64} />
          <div>
            <h1 style={{ fontSize: 26 }}>{t.title}</h1>
            <p>{t.authority}{t.department ? ` · ${t.department}` : ""}{t.district ? ` · ${t.district}` : ""}{t.state ? `, ${t.state}` : ""}</p>
            <div className="row tiny faint" style={{ gap: 10, marginTop: 6 }}>
              <span>{t.portal}</span><span>Tender ID {t.tender_ref}</span>{t.url && <a href={t.url} target="_blank" rel="noreferrer">Open portal</a>}
              {!m.eligible && <span className="chip bad">Not eligible on current Vault</span>}
            </div>
          </div>
        </div>
        <Link className="btn ghost" href={`/app/tasks?link_type=tender&link_id=${t.id}&link_label=${encodeURIComponent(t.title.slice(0, 80))}&title=${encodeURIComponent("Prepare bid: " + t.title.slice(0, 120))}`}>Assign to someone</Link>
      </div>

      <div className="grid">
        {[["Estimated value", t.value_inr ? lakh(t.value_inr) : "Not stated"], ["EMD", t.emd_inr ? (msme && t.mse_emd_exempt ? `${lakh(t.emd_inr)} · exempt` : lakh(t.emd_inr)) : "Nil"], ["Bid closes", `${fmtDate(t.due_at)}${left >= 0 ? ` · ${left} d` : " · closed"}`], ["Pre-bid meeting", t.prebid_on ? fmtDate(t.prebid_on) : "—"]].map(([l, v]) => (
          <div key={l} className="panel ledger"><div className="kpi-label">{l}</div><div className="kpi" style={{ fontSize: 22 }}>{v}</div></div>
        ))}
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="panel">
            <div className="panel-head"><h3>Why this score</h3><span className="tiny faint">{t.eligibility_source === "norms" ? "Using standard CPWD / PWD norms until the tender is read in full" : "From the tender document"}</span></div>
            <ul className="reasons" style={{ fontSize: 14 }}>
              {(m.reasons || []).map((r, i) => <li key={i}><Icon name={r.ok ? "check" : "cross"} size={15} style={{ color: r.ok ? "var(--leaf)" : "var(--blood)" }} />{r.text}</li>)}
            </ul>
          </div>
          <div className="panel flush table-wrap">
            <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Documents for this bid</h3><span className="small faint">{ready} of {checklist.length} ready</span></div>
            <table>
              <tbody>
                {checklist.map((x) => (
                  <tr key={x.code}>
                    <td><strong>{x.name}</strong>{x.d && <div className="tiny faint">{[x.d.number, x.d.period].filter(Boolean).join(" · ")}</div>}</td>
                    <td>{x.state === "ok" ? <span className="chip ok">In Vault</span> : x.state === "expiring" ? <span className="chip warn">Expires {fmtDate(x.d.valid_until)}</span> : <span className="chip bad">Missing</span>}</td>
                    <td>{x.state !== "ok" && <Link href="/app/vault/documents" className="small">Add</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!changes?.length && (
            <div className="panel">
              <h3>Changes since published</h3>
              {changes.map((ch) => <div key={ch.id} className="small row between" style={{ padding: "4px 0" }}><span>{{ due_at: "Due date", value_inr: "Value", emd_inr: "EMD", status: "Status" }[ch.field] || ch.field} changed</span><span className="faint">{ago(ch.seen_at)}</span></div>)}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="panel stack-sm">
            <h3>Bid pack</h3>
            <p className="small muted" style={{ margin: 0 }}>Covering letter and Annexures A–G filled from your Vault: bidder information, turnover, similar works, key people, non-blacklisting{msme ? ", MSE declaration" : ""} and the document checklist{kinds.has("letterhead") ? ", printed on your letterhead" : " (add your letterhead to print on it)"}.</p>
            {gaps.length > 0 && (
              <div className="notice small" style={{ display: "block" }}>
                <strong>Fill these once and every bid uses them:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{gaps.map((g) => <li key={g.label}><Link href={g.href}>{g.label}</Link></li>)}</ul>
              </div>
            )}
            {!canMake ? <p className="small muted">Your role cannot make bid packs. Ask a bid preparer or admin.</p> : (
              <>
                <BidPackForm matchId={m.id} kind="draft" note="Unsigned and marked DRAFT, for checking. No credits used." />
                <hr style={{ border: 0, borderTop: "1px solid var(--line-soft)", width: "100%" }} />
                <BidPackForm matchId={m.id} kind="final" disabled={!isAdmin || !has2fa || !kinds.has("signature")}
                  note={!isAdmin ? "Only an admin (the signatory) can sign." : !has2fa ? "Turn on two-factor login in Security to sign." : !kinds.has("signature") ? "Upload the signature in Letterhead & signature to sign." : `Places the signature${kinds.has("seal") ? " and seal" : ""} on every page that needs it and logs the use. 299 credits (you have ${Math.floor(Number(wallet?.balance || 0))}).`} />
              </>
            )}
          </div>
          <div className="panel flush">
            <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Generated packs</h3></div>
            {!signed.length && <p className="muted small" style={{ padding: "0 22px 18px", margin: 0 }}>None yet.</p>}
            {signed.map((p) => (
              <div key={p.id} className="row between" style={{ padding: "12px 22px", borderTop: "1px solid var(--line-soft)", flexWrap: "nowrap" }}>
                <div><span className={`chip ${p.kind === "final" ? "ok" : "mute"}`}>{p.kind === "final" ? "Signed" : "Draft"}</span> <span className="small">{p.pages} pages · {ago(p.created_at)}</span></div>
                {p.url && <a className="btn sm ghost" href={p.url} target="_blank" rel="noreferrer">Download</a>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
