import Link from "next/link";
import { getContext } from "@/lib/session";
import FormState from "@/app/app/FormState";
import SubmitButton from "@/components/SubmitButton";
import { saveReply, addStarterReplies } from "../actions";
import { PLACEHOLDERS, filterReplies } from "@/lib/savedReplies";

export const metadata = { title: "Saved replies" };

// Saved replies (C45): the team's ready answers, picked with one tap in the WhatsApp inbox.
export default async function SavedReplies({ searchParams }) {
  const sp = await searchParams;
  const { supabase, tenant, role } = await getContext();
  const canEdit = !["viewer", "disabled"].includes(role);
  const { data: rows } = await supabase.from("saved_replies").select("*").eq("tenant_id", tenant.id).order("title");
  const live = filterReplies(rows || []);
  const archived = (rows || []).filter((r) => r.archived);
  const editing = sp?.edit ? (rows || []).find((r) => r.id === sp.edit) : null;
  return (
    <div className="stack">
      <Link href="/app/inbox" className="small">WhatsApp inbox</Link>
      <div className="page-head"><div><h1>Saved replies</h1><p>Ready answers the team sends with one tap from the inbox — fees, documents needed, bank details, address. Write them once; everyone uses the same wording.</p></div></div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>{editing ? "Change this reply" : "Add a reply"}</h3>
          {canEdit ? (
            <FormState action={saveReply} submit={editing ? "Save changes" : "Add reply"} className="stack-sm" key={editing?.id || "new"}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <div><label htmlFor="r-title">Title</label><input id="r-title" name="title" required maxLength={80} defaultValue={editing?.title || ""} placeholder="e.g. Fees and proposal" /></div>
              <div><label htmlFor="r-short">Shortcut (type /shortcut in the picker)</label><input id="r-short" name="shortcut" maxLength={24} defaultValue={editing?.shortcut || ""} placeholder="fees" /></div>
              <div><label htmlFor="r-body">Text</label><textarea id="r-body" name="body" required rows={6} maxLength={4000} defaultValue={editing?.body || ""} /></div>
              <p className="tiny faint" style={{ margin: 0 }}>Filled in for each client: {PLACEHOLDERS.map((p) => `{${p}}`).join(" ")}</p>
              {editing && <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="archived" defaultChecked={editing.archived} style={{ width: "auto" }} />Archived (hidden from the picker)</label>}
            </FormState>
          ) : <p className="small muted">Viewers can see the replies but not change them.</p>}
          {editing && <Link href="/app/inbox/replies" className="small">Add a new one instead</Link>}
        </div>
        <div className="panel stack-sm">
          <div className="row between"><h3 style={{ margin: 0 }}>Your replies</h3><span className="chip mute">{live.length}</span></div>
          {!live.length && (
            <div className="stack-sm">
              <p className="small muted" style={{ margin: 0 }}>None yet. Start with six common ones and edit them to your wording.</p>
              {canEdit && <form action={addStarterReplies}><SubmitButton className="sm">Add the starter set</SubmitButton></form>}
            </div>
          )}
          {live.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
              <div className="row between" style={{ flexWrap: "nowrap", gap: 8 }}>
                <strong className="small">{r.title}{r.shortcut ? <span className="tiny faint"> · /{r.shortcut}</span> : null}</strong>
                <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}><span className="tiny faint">used {r.uses}×</span>{canEdit && <Link href={`/app/inbox/replies?edit=${r.id}`} className="small">Edit</Link>}</span>
              </div>
              <p className="small muted" style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{r.body}</p>
            </div>
          ))}
          {archived.length > 0 && <p className="tiny faint" style={{ margin: 0 }}>{archived.length} archived: {archived.map((r) => <Link key={r.id} href={`/app/inbox/replies?edit=${r.id}`} style={{ marginRight: 8 }}>{r.title}</Link>)}</p>}
        </div>
      </div>
    </div>
  );
}
