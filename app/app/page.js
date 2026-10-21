import Link from "next/link";
import { getContext, daysLeft, inr, lakh, fmtDate } from "@/lib/session";
import { Gauge, ScoreRing, Sparkline, StageBars } from "@/components/Charts";
import Icon from "@/components/Icon";

const CORE_DOCS = ["REG-PAN", "REG-GST", "REG-INC", "FIN-AUDIT", "FIN-ITR", "EXP-CC"];
const CORE_FIELDS = ["legal_name", "constitution", "pan", "gstin", "registered_address", "state", "pincode", "email", "phone", "signatory_name", "signatory_designation", "bank_account", "bank_ifsc"];
const STAGES = [["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["meeting", "Meeting"], ["proposal", "Proposal"], ["negotiation", "Negotiation"], ["won", "Won"]];

export default async function Dashboard() {
  const { supabase, tenant, company, user } = await getContext();
  const [{ data: c }, { data: docs }, { data: wallet }, { data: brand }, { data: ledger }, { data: matches }, { data: deals }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("documents").select("id, type_code, title, valid_until, document_types(name)").eq("company_id", company.id),
    supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("brand_assets").select("kind").eq("company_id", company.id),
    supabase.from("credit_ledger").select("delta, balance_after, created_at, reason").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("tender_matches").select("score, status, eligible, tenders(title, authority, value_inr, due_at)").eq("company_id", company.id).order("score", { ascending: false }),
    supabase.from("deals").select("id, stage, value_inr, title, next_action, next_action_at").eq("company_id", company.id),
  ]);
  const fieldsDone = CORE_FIELDS.filter((f) => c?.[f]).length;
  const docCodes = new Set((docs || []).map((d) => d.type_code));
  const docsDone = CORE_DOCS.filter((d) => docCodes.has(d)).length;
  const brandKinds = new Set((brand || []).map((b) => b.kind));
  const brandDone = ["letterhead", "signature", "seal"].filter((k) => brandKinds.has(k)).length;
  const pct = Math.round(((fieldsDone + docsDone + brandDone) / (CORE_FIELDS.length + CORE_DOCS.length + 3)) * 100);
  const expiring = (docs || []).filter((d) => d.valid_until && daysLeft(d.valid_until) <= 60).sort((a, b) => new Date(a.valid_until) - new Date(b.valid_until));
  const openTenders = (matches || []).filter((m) => m.eligible && m.tenders && daysLeft(m.tenders.due_at) >= 0 && !["skipped", "won", "lost"].includes(m.status));
  const pipeline = STAGES.map(([k, label]) => ({ label, value: (deals || []).filter((d) => d.stage === k).reduce((s, d) => s + Number(d.value_inr || 0), 0), color: k === "won" ? "var(--leaf)" : undefined }));
  const openValue = (deals || []).filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value_inr || 0), 0);
  const followUps = (deals || []).filter((d) => d.next_action_at && !["won", "lost"].includes(d.stage)).sort((a, b) => new Date(a.next_action_at) - new Date(b.next_action_at)).slice(0, 4);
  const firstName = (user.user_metadata?.full_name || "").split(" ")[0];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{firstName ? `Namaste, ${firstName}.` : "Namaste."}</h1>
          <p>{openTenders.length} tenders worth bidding on, {expiring.length} documents to renew, {followUps.length} follow-ups coming up.</p>
        </div>
        <Link href="/app/tenders" className="btn gold"><Icon name="tender" /> See tender matches</Link>
      </div>

      <div className="grid-3">
        <div className="panel ledger">
          <div className="kpi-label">Open pipeline</div>
          <div className="kpi num">{lakh(openValue)}</div>
          <div className="faint small">{(deals || []).filter((d) => !["won", "lost"].includes(d.stage)).length} live deals</div>
        </div>
        <div className="panel ledger">
          <div className="kpi-label">Tenders you qualify for</div>
          <div className="kpi num">{openTenders.length}</div>
          <div className="faint small">worth {lakh(openTenders.reduce((s, m) => s + Number(m.tenders.value_inr || 0), 0))} in total</div>
        </div>
        <div className="panel ledger">
          <div className="kpi-label">Credits left</div>
          <div className="kpi num">{inr(wallet?.balance)}</div>
          <Sparkline points={(ledger || []).map((l) => Number(l.balance_after))} height={38} label="Credit balance over time" />
        </div>
      </div>

      <div className="grid-2">
        <div className="panel flush">
          <div className="panel-head" style={{ padding: "18px 22px 0" }}><h3>Best tender matches</h3><Link href="/app/tenders" className="small">All tenders</Link></div>
          {openTenders.slice(0, 4).map((m, i) => (
            <div key={i} className="row" style={{ padding: "12px 22px", borderTop: "1px solid var(--line-soft)", flexWrap: "nowrap" }}>
              <ScoreRing score={m.score} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.tenders.title}</div>
                <div className="small muted">{m.tenders.authority} · {lakh(m.tenders.value_inr)}</div>
              </div>
              <span className={`chip ${daysLeft(m.tenders.due_at) <= 7 ? "bad" : "warn"}`}>{daysLeft(m.tenders.due_at)} days</span>
            </div>
          ))}
          {!openTenders.length && <p className="muted small" style={{ padding: "0 22px 18px" }}>No open matches yet.</p>}
        </div>
        <div className="panel" style={{ display: "grid", justifyItems: "center", alignContent: "start" }}>
          <div className="panel-head" style={{ width: "100%" }}><h3>Vault readiness</h3><Link href="/app/vault/profile" className="small">Complete</Link></div>
          <Gauge value={pct} label="ready for bids" />
          <div style={{ width: "100%", display: "grid", gap: 8, marginTop: 6 }} className="small">
            {[["Profile fields", fieldsDone, CORE_FIELDS.length], ["Core documents", docsDone, CORE_DOCS.length], ["Letterhead, signature, seal", brandDone, 3]].map(([l, a, b]) => (
              <div key={l} className="row between"><span className="muted">{l}</span><strong className="num">{a}/{b}</strong></div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h3>Pipeline by stage</h3><Link href="/app/crm" className="small">Open CRM</Link></div>
          <StageBars rows={pipeline} format={(v) => (v ? lakh(v) : "—")} />
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Coming up</h3></div>
          <div className="stack-sm">
            {expiring.slice(0, 3).map((d) => {
              const left = daysLeft(d.valid_until);
              return (
                <div key={d.id} className="row" style={{ flexWrap: "nowrap" }}>
                  <Icon name="alert" style={{ color: left < 0 ? "var(--blood)" : "var(--rust)" }} />
                  <div style={{ flex: 1 }}><strong>{d.title || d.document_types?.name}</strong><div className="tiny faint">{left < 0 ? `expired ${-left} days ago` : `expires ${fmtDate(d.valid_until)}`}</div></div>
                  <span className={`chip ${left <= 15 ? "bad" : "warn"}`}>{left < 0 ? "Expired" : `${left} d`}</span>
                </div>
              );
            })}
            {followUps.map((d, i) => (
              <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
                <Icon name="clock" style={{ color: "var(--sky)" }} />
                <div style={{ flex: 1 }}><Link href={`/app/crm/${d.id}`}><strong>{d.next_action}</strong></Link><div className="tiny faint">{d.title}</div></div>
                <span className="chip info">{daysLeft(d.next_action_at) <= 0 ? "Today" : daysLeft(d.next_action_at) === 1 ? "Tomorrow" : fmtDate(d.next_action_at).replace(/ \d{4}$/, "")}</span>
              </div>
            ))}
            {!expiring.length && !followUps.length && <p className="muted small">Nothing due. </p>}
          </div>
        </div>
      </div>
    </div>
  );
}
