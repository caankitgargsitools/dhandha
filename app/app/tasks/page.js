import Link from "next/link";
import { getContext, calDays as daysLeft, fmtDate } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import FormState from "../FormState";
import Icon from "@/components/Icon";
import { createTask, setTaskStatus } from "./actions";

const PRI = { low: ["mute", "Low"], normal: ["info", "Normal"], high: ["warn", "High"], urgent: ["bad", "Urgent"] };
const LINK_HREF = { tender: "/app/tenders", deal: "/app/crm", lead: "/app/leads", document: "/app/vault/documents", ticket: "/app/support" };

export default async function Tasks({ searchParams }) {
  const params = await searchParams;
  const { supabase, tenant, user, role } = await getContext();
  const isLead = ["admin", "manager"].includes(role);
  const view = ["mine", "given", "team", "done"].includes(params?.view) ? params.view : "mine";
  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase.from("tasks").select("*").eq("tenant_id", tenant.id).order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
  ]);
  const name = (id) => { const m = (members || []).find((x) => x.user_id === id); return m ? m.profiles?.full_name || m.profiles?.email : "Unassigned"; };
  const open = (t) => ["todo", "in_progress"].includes(t.status);
  const all = tasks || [];
  const lists = {
    mine: all.filter((t) => t.assigned_to === user.id && open(t)),
    given: all.filter((t) => t.created_by === user.id && t.assigned_to !== user.id && open(t)),
    team: all.filter(open),
    done: all.filter((t) => !open(t)).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
  };
  const list = lists[view];
  const overdue = lists.team.filter((t) => t.due_at && daysLeft(t.due_at) < 0).length;
  const prefill = { type: params?.link_type, id: params?.link_id, label: params?.link_label, title: params?.title };
  const tabs = [["mine", "My tasks"], ["given", "Assigned by me"], ...(isLead ? [["team", "Whole team"]] : []), ["done", "Done"]];

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Tasks</h1><p>Assign work to your team with a due date. {isLead ? "Managers see everyone's tasks;" : "You see"} {isLead ? "others see only their own." : "tasks given to you or by you."}</p></div>
      </div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">On my plate</div><div className="kpi">{lists.mine.length}</div><div className="faint small">{lists.mine.filter((t) => t.due_at && daysLeft(t.due_at) <= 0).length} due today or late</div></div>
        <div className="panel ledger"><div className="kpi-label">Open across team</div><div className="kpi">{isLead ? lists.team.length : "—"}</div><div className="faint small">{isLead ? `${(members || []).length} people` : "visible to managers"}</div></div>
        <div className="panel ledger"><div className="kpi-label">Overdue</div><div className="kpi" style={{ color: overdue ? "var(--blood)" : undefined }}>{isLead ? overdue : lists.mine.filter((t) => t.due_at && daysLeft(t.due_at) < 0).length}</div><div className="faint small">past the due date</div></div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack-sm">
          <div className="row">{tabs.map(([k, l]) => <Link key={k} href={`/app/tasks?view=${k}`} className={`btn sm ${view === k ? "" : "ghost"}`}>{l} <span className="faint">({lists[k].length})</span></Link>)}</div>
          <div className="panel flush">
            {!list.length && <p className="muted" style={{ padding: 22, margin: 0 }}>Nothing here.</p>}
            {list.map((t) => {
              const left = t.due_at ? daysLeft(t.due_at) : null;
              return (
                <div key={t.id} style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)" }}>
                  <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ textDecoration: t.status === "done" ? "line-through" : undefined }}>{t.title}</strong>
                      {t.details && <div className="small muted">{t.details}</div>}
                      <div className="row tiny faint" style={{ gap: 10, marginTop: 6 }}>
                        <span className={`chip ${PRI[t.priority][0]}`}>{PRI[t.priority][1]}</span>
                        <span>To: <strong>{name(t.assigned_to)}</strong></span>
                        <span>From: {t.created_by === user.id ? "you" : name(t.created_by)}</span>
                        {t.link_type && <Link href={["deal", "lead"].includes(t.link_type) && t.link_id ? `${LINK_HREF[t.link_type]}/${t.link_id}` : LINK_HREF[t.link_type]}>{t.link_label || t.link_type}</Link>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      {left !== null && open(t) && <span className={`chip ${left < 0 ? "bad" : left <= 1 ? "warn" : "mute"}`}>{left < 0 ? `${-left} d late` : left === 0 ? "Due today" : `Due ${fmtDate(t.due_at).replace(/ \d{4}$/, "")}`}</span>}
                      {t.status === "in_progress" && <div className="tiny faint" style={{ marginTop: 4 }}>In progress</div>}
                      {t.status === "done" && <span className="chip ok">Done</span>}
                    </div>
                  </div>
                  {(t.assigned_to === user.id || t.created_by === user.id || isLead) && (
                    <div className="row" style={{ gap: 6, marginTop: 10 }}>
                      {t.status === "todo" && <StatusBtn id={t.id} status="in_progress" label="Start" />}
                      {open(t) && <StatusBtn id={t.id} status="done" label="Mark done" gold />}
                      {!open(t) && <StatusBtn id={t.id} status="todo" label="Reopen" />}
                      {open(t) && (t.created_by === user.id || isLead) && <StatusBtn id={t.id} status="cancelled" label="Cancel" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {role !== "viewer" && (
          <div className="panel">
            <h3>Assign a task</h3>
            <FormState action={createTask} submit="Assign task">
              <div><label htmlFor="title">What needs doing</label><input id="title" name="title" required maxLength={200} defaultValue={prefill.title || ""} placeholder="e.g. Get fresh solvency certificate from HDFC" /></div>
              <div className="form-grid">
                <div>
                  <label htmlFor="assigned_to">Assign to</label>
                  <select id="assigned_to" name="assigned_to" defaultValue={user.id}>
                    {(members || []).map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === user.id ? "Me" : m.profiles?.full_name || m.profiles?.email} · {ROLES[m.role]?.label}</option>)}
                  </select>
                </div>
                <div><label htmlFor="due">Due date</label><input id="due" name="due" type="date" /></div>
                <div>
                  <label htmlFor="priority">Priority</label>
                  <select id="priority" name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
                </div>
              </div>
              <div><label htmlFor="details">Notes</label><textarea id="details" name="details" rows={3} /></div>
              {prefill.type && (
                <div className="notice info small"><Icon name="tender" /><span>Linked to {prefill.type}: <strong>{prefill.label}</strong></span>
                  <input type="hidden" name="link_type" value={prefill.type} /><input type="hidden" name="link_id" value={prefill.id || ""} /><input type="hidden" name="link_label" value={prefill.label || ""} /></div>
              )}
            </FormState>
            {(members || []).length < 2 && <p className="small muted" style={{ marginBottom: 0 }}>Only you are in this workspace. <Link href="/app/settings/team">Add your team</Link> to assign them work.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBtn({ id, status, label, gold }) {
  return (
    <form action={setTaskStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><button className={`sm ${gold ? "gold" : "ghost"}`}>{label}</button></form>
  );
}
