import Link from "next/link";
import { getContext } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";
import Chat from "./Chat";
import { threadAction } from "./actions";

export const metadata = { title: "WhatsApp inbox" };

const TABS = [["mine", "Mine"], ["unassigned", "Unassigned"], ["all", "All open"], ["closed", "Closed"]];
const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  return m < 1 ? "now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};

export default async function Inbox({ searchParams }) {
  const sp = await searchParams;
  const { supabase, tenant, user, role } = await getContext();
  const all = ["admin", "manager"].includes(role);
  const f = TABS.some(([k]) => k === sp?.f) ? sp.f : all ? "all" : "mine";
  let q = supabase.from("wa_threads").select("id, phone, name, assigned_to, status, unread, last_in_at, last_at, last_text, lead_id, leads(name, contact_person)")
    .eq("tenant_id", tenant.id).order("last_at", { ascending: false }).limit(100);
  q = f === "closed" ? q.eq("status", "closed") : q.eq("status", "open");
  if (f === "mine") q = q.eq("assigned_to", user.id);
  if (f === "unassigned") q = q.is("assigned_to", null);
  const [{ data: threads, error }, { data: members }, { data: s }] = await Promise.all([
    q,
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
    supabase.from("outreach_settings").select("wa_connected_at, wa_hook_token, wa_app_secret").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  const open = sp?.t ? (threads || []).find((t) => t.id === sp.t) || (await supabase.from("wa_threads").select("*, leads(name, contact_person)").eq("id", sp.t).maybeSingle()).data : null;
  const { data: messages } = open ? await supabase.from("wa_messages").select("id, direction, body, status, error, auto, created_at").eq("thread_id", open.id).order("id").limit(300) : { data: [] };
  const who = (id) => { const m = (members || []).find((x) => x.user_id === id); return id === user.id ? "Me" : m?.profiles?.full_name || m?.profiles?.email || "—"; };
  const ready = s?.wa_connected_at && s?.wa_hook_token && s?.wa_app_secret;
  const label = (t) => t.leads?.contact_person || t.name || t.leads?.name || `+91 ${t.phone}`;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>WhatsApp inbox</h1>
          <p>Clients&apos; WhatsApp replies to your business number, in one place for the team. Each conversation is filed under the lead, stops that lead&apos;s playbook, and can be answered from here.</p>
        </div>
      </div>
      {error && <p className="error">{/does not exist/.test(error.message) ? "The WhatsApp inbox is being switched on — try again shortly." : error.message}</p>}
      {!ready && <div className="notice">To receive replies here, connect your WhatsApp Business number and its webhook: <Link href="/app/outreach/settings#inbox">Outreach → Sender settings → Receive replies</Link>.</div>}

      <div className="row" style={{ gap: 6 }}>
        {TABS.filter(([k]) => all || k !== "unassigned").map(([k, l]) => <Link key={k} href={`/app/inbox?f=${k}`} className={f === k ? "btn sm" : "btn ghost sm"}>{l}</Link>)}
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "minmax(240px, 1fr) 2fr", alignItems: "start" }}>
        <div className="panel flush">
          {!(threads || []).length && <p className="muted small" style={{ padding: 16 }}>No conversations here.</p>}
          {(threads || []).map((t) => (
            <Link key={t.id} href={`/app/inbox?f=${f}&t=${t.id}`} style={{ display: "block", padding: "10px 14px", borderBottom: "1px solid var(--line-soft)", background: open?.id === t.id ? "var(--primary-soft)" : undefined, color: "inherit", textDecoration: "none" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong className="small">{label(t)}</strong>
                <span className="tiny faint">{ago(t.last_at)}{t.unread ? <span className="chip warn" style={{ marginLeft: 6 }}>{t.unread}</span> : null}</span>
              </div>
              <div className="tiny faint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.last_text}</div>
              {all && <div className="tiny faint">{t.assigned_to ? who(t.assigned_to) : "Unassigned"}</div>}
            </Link>
          ))}
        </div>

        <div className="panel">
          {!open ? <p className="muted small">Pick a conversation.</p> : (
            <div className="stack-sm">
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{label(open)}</h3>
                  <div className="tiny faint">+91 {open.phone}{open.lead_id ? <> · <Link href={`/app/leads/${open.lead_id}`}>Open lead</Link></> : null}</div>
                </div>
                <form action={threadAction} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="id" value={open.id} />
                  {all ? (
                    <select name="user" defaultValue={open.assigned_to || ""} style={{ width: "auto" }}>
                      <option value="">Unassigned</option>
                      {(members || []).map((m) => <option key={m.user_id} value={m.user_id}>{who(m.user_id)}</option>)}
                    </select>
                  ) : <input type="hidden" name="user" value={user.id} />}
                  <SubmitButton name="action" value="assign" className="ghost sm">{all ? "Assign" : "Take it"}</SubmitButton>
                  <SubmitButton name="action" value={open.status === "open" ? "close" : "open"} className="ghost sm">{open.status === "open" ? "Close" : "Reopen"}</SubmitButton>
                </form>
              </div>
              <Chat thread={open} messages={messages || []} canSend={!["viewer", "disabled"].includes(role)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
