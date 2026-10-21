import Link from "next/link";
import { getContext, lakh, fmtDate, calDays } from "@/lib/session";
import { StageBars } from "@/components/Charts";
import Icon from "@/components/Icon";
import FormState from "../FormState";
import OwnerSelect from "@/components/OwnerSelect";
import { STAGES } from "@/lib/leads";
import { createDeal, moveDeal } from "./actions";

const OPEN = STAGES.filter(([k]) => !["won", "lost"].includes(k));

export default async function Crm({ searchParams }) {
  const params = await searchParams;
  const { supabase, tenant, company, user, role } = await getContext();
  const mineOnly = params?.who === "mine";
  const [{ data: all }, { data: members }, { data: leads }] = await Promise.all([
    supabase.from("deals").select("*, leads(name, city)").eq("company_id", company.id).order("next_action_at", { ascending: true, nullsFirst: false }),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
    supabase.from("leads").select("id, name").eq("company_id", company.id).not("status", "in", "(junk,not_interested)").order("name").limit(500),
  ]);
  const deals = (all || []).filter((d) => !mineOnly || d.owner_id === user.id);
  const name = (d) => { const m = (members || []).find((x) => x.user_id === d.owner_id); return m ? (m.user_id === user.id ? "You" : m.profiles?.full_name || m.profiles?.email) : d.owner_name || "Unassigned"; };
  const open = deals.filter((d) => !["won", "lost"].includes(d.stage));
  const overdue = open.filter((d) => d.next_action_at && calDays(d.next_action_at) < 0);
  const sum = (xs) => xs.reduce((s, d) => s + Number(d.value_inr || 0), 0);
  const q = new Date(); const qStart = new Date(q.getFullYear(), Math.floor(q.getMonth() / 3) * 3, 1);
  const wonQ = deals.filter((d) => d.stage === "won" && new Date(d.closed_at || d.created_at) >= qStart);
  const closed = deals.filter((d) => ["won", "lost"].includes(d.stage));
  const winRate = closed.length ? Math.round((closed.filter((d) => d.stage === "won").length / closed.length) * 100) : null;
  const funnel = OPEN.map(([k, label], i) => ({ label, value: sum(deals.filter((d) => d.stage === k)), color: ["var(--sky)", "var(--sky)", "var(--marigold)", "var(--marigold)", "var(--madder)", "var(--madder)"][i] }));
  const canWrite = role !== "viewer";
  const sellers = (members || []).filter((m) => ["admin", "manager", "telecaller", "field"].includes(m.role));
  const showLost = params?.lost === "1";

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>CRM pipeline</h1><p>Every deal has a next step and a date. Steps overdue by more than 24 hours go to a manager as a task.</p></div>
        <div className="row">
          <Link href={`/app/crm?${mineOnly ? "" : "who=mine"}`} className="btn ghost sm">{mineOnly ? "Show everyone's" : "Only my deals"}</Link>
          <Link href={`/app/crm?${new URLSearchParams({ ...(mineOnly ? { who: "mine" } : {}), ...(showLost ? {} : { lost: "1" }) })}`} className="btn ghost sm">{showLost ? "Hide lost" : "Show lost"}</Link>
        </div>
      </div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Open pipeline</div><div className="kpi">{lakh(sum(open))}</div><div className="faint small">{open.length} deals{winRate !== null ? ` · ${winRate}% win rate` : ""}</div></div>
        <div className="panel ledger"><div className="kpi-label">Won this quarter</div><div className="kpi">{lakh(sum(wonQ))}</div><div className="faint small">{wonQ.length} deals</div></div>
        <div className="panel ledger"><div className="kpi-label">Overdue next steps</div><div className="kpi" style={{ color: overdue.length ? "var(--blood)" : undefined }}>{overdue.length}</div><div className="faint small">need action today</div></div>
      </div>

      <div className="board">
        {STAGES.filter(([k]) => showLost || k !== "lost").map(([k, label]) => {
          const items = deals.filter((d) => d.stage === k);
          return (
            <section key={k} className="lane" aria-label={label}>
              <div className="lane-head"><span>{label}</span><span className="faint">{items.length} · {lakh(sum(items))}</span></div>
              {items.map((d) => {
                const left = d.next_action_at ? calDays(d.next_action_at) : null;
                const late = left !== null && left < 0 && !["won", "lost"].includes(d.stage);
                return (
                  <div key={d.id} className="deal" style={late ? { borderColor: "var(--blood)" } : undefined}>
                    <Link href={`/app/crm/${d.id}`}><h5>{d.leads?.name || d.title}</h5></Link>
                    {d.leads?.name && <div className="small muted">{d.title}</div>}
                    <div className="row between" style={{ marginTop: 8 }}>
                      <strong className="num">{d.value_inr ? lakh(d.value_inr) : "—"}</strong>
                      <span className="tiny faint">{name(d)}</span>
                    </div>
                    {d.next_action && !["won", "lost"].includes(d.stage) && (
                      <div className="row tiny" style={{ marginTop: 8, gap: 6, color: late ? "var(--blood)" : "var(--ink-2)" }}>
                        <Icon name="clock" size={13} />{d.next_action} · {left === null ? "no date" : left === 0 ? "today" : fmtDate(d.next_action_at).replace(/ \d{4}$/, "")}
                      </div>
                    )}
                    {canWrite && (
                      <form action={moveDeal} className="row" style={{ gap: 6, marginTop: 8, flexWrap: "nowrap" }}>
                        <input type="hidden" name="id" value={d.id} />
                        <select name="stage" defaultValue={d.stage} aria-label={`Move ${d.title}`} style={{ padding: "4px 8px", fontSize: 12 }}>
                          {STAGES.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
                        </select>
                        <button className="ghost sm">Move</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          <div className="panel-head"><h3>Value by stage</h3><span className="faint small">open deals</span></div>
          <StageBars rows={funnel} format={lakh} />
        </div>
        {canWrite && (
          <div className="panel">
            <h3>New deal</h3>
            <FormState action={createDeal} submit="Open deal">
              <div><label htmlFor="title">What are you selling</label><input id="title" name="title" required maxLength={200} placeholder="e.g. Annual GST + audit retainer" /></div>
              <div className="form-grid">
                <div><label htmlFor="lead_id">For lead</label><select id="lead_id" name="lead_id" defaultValue=""><option value="">— none —</option>{(leads || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                <div><label htmlFor="value_inr">Value (₹)</label><input id="value_inr" name="value_inr" inputMode="numeric" /></div>
                <div><label htmlFor="stage">Stage</label><select id="stage" name="stage" defaultValue="new">{OPEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                {["admin", "manager", "bid_preparer"].includes(role) && <OwnerSelect members={sellers} me={user.id} />}
              </div>
              <div className="form-grid">
                <div><label htmlFor="next_action">Next step</label><input id="next_action" name="next_action" maxLength={120} placeholder="Call to fix meeting" /></div>
                <div><label htmlFor="next_at">By</label><input id="next_at" name="next_at" type="date" /></div>
              </div>
            </FormState>
          </div>
        )}
      </div>
    </div>
  );
}
