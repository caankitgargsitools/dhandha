import { getContext, lakh, fmtDate, daysLeft } from "@/lib/session";
import PreviewNote from "@/components/PreviewNote";
import Icon from "@/components/Icon";

const STAGES = [["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["meeting", "Meeting"], ["proposal", "Proposal sent"], ["negotiation", "Negotiation"], ["won", "Won"], ["lost", "Lost"]];

export default async function Crm() {
  const { supabase, company } = await getContext();
  const { data: deals } = await supabase.from("deals").select("*, leads(name, city)").eq("company_id", company.id).order("value_inr", { ascending: false });
  const open = (deals || []).filter((d) => !["won", "lost"].includes(d.stage));
  const overdue = open.filter((d) => d.next_action_at && daysLeft(d.next_action_at) < 0).length;
  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>CRM pipeline</h1><p>Every deal has a next step and a date. Overdue steps go to the manager after 24 hours.</p></div>
      </div>
      <PreviewNote>WhatsApp, email, SMS and AI calling sequences arrive in Phase 3.</PreviewNote>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Open pipeline</div><div className="kpi">{lakh(open.reduce((s, d) => s + Number(d.value_inr || 0), 0))}</div><div className="faint small">{open.length} deals</div></div>
        <div className="panel ledger"><div className="kpi-label">Won</div><div className="kpi">{lakh((deals || []).filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.value_inr || 0), 0))}</div><div className="faint small">this quarter</div></div>
        <div className="panel ledger"><div className="kpi-label">Overdue follow-ups</div><div className="kpi" style={{ color: overdue ? "var(--blood)" : undefined }}>{overdue}</div><div className="faint small">need action today</div></div>
      </div>
      <div className="board">
        {STAGES.map(([k, label]) => {
          const items = (deals || []).filter((d) => d.stage === k);
          return (
            <section key={k} className="lane" aria-label={label}>
              <div className="lane-head"><span>{label}</span><span className="faint">{items.length} · {lakh(items.reduce((s, d) => s + Number(d.value_inr || 0), 0))}</span></div>
              {items.map((d) => {
                const left = d.next_action_at ? daysLeft(d.next_action_at) : null;
                return (
                  <div key={d.id} className="deal">
                    <h5>{d.leads?.name || d.title}</h5>
                    <div className="small muted">{d.title}</div>
                    <div className="row between" style={{ marginTop: 8 }}>
                      <strong className="num">{d.value_inr ? lakh(d.value_inr) : "—"}</strong>
                      <span className="tiny faint">{d.owner_name}</span>
                    </div>
                    {d.next_action && (
                      <div className="row tiny" style={{ marginTop: 8, gap: 6, color: left !== null && left < 0 ? "var(--blood)" : "var(--ink-2)" }}>
                        <Icon name="clock" size={13} />{d.next_action} · {left === 0 ? "today" : fmtDate(d.next_action_at).replace(/ \d{4}$/, "")}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
