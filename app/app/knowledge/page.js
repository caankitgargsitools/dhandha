import Link from "next/link";
import { getContext } from "@/lib/session";
import { KINDS, searchKb } from "@/lib/knowledge";
import AskBox from "./AskBox";
import ArticleForm from "./ArticleForm";
import { archiveArticle, addStarters } from "./actions";

export const metadata = { title: "Knowledge base" };

// Knowledge base (13 Nov, map item 9): the firm's own notes — SOPs, contract terms, policies, client FAQs, templates,
// lessons — searched free, asked with AI from the notes only; plus links to what Dhandha already keeps for you.
export default async function Knowledge({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  const { data } = await supabase.from("kb_articles").select("*").eq("company_id", company.id).is("archived_at", null).order("updated_at", { ascending: false }).limit(500);
  const all = data || [];
  const canEdit = ["admin", "manager", "bid_preparer"].includes(role);
  const kind = KINDS[sp?.kind] ? sp.kind : null;
  const q = String(sp?.q || "").slice(0, 200);
  const hits = searchKb(all, q, { kind });
  const open = all.find((a) => a.id === sp?.a) || null;
  const editing = canEdit && (sp?.edit === "1" || sp?.new === "1");
  const HUB = [
    ["Price list", "/app/crm/catalog", "Your items and rates for quotations and invoices"],
    ["Brand voice", "/app/posts", "How your posts sound"],
    ["Job history", "/app/vault/experience", "Completed works and their values"],
    ["Documents", "/app/vault/documents", "Certificates, registrations, statements"],
    ["Saved replies", "/app/inbox/replies", "Ready WhatsApp answers"],
    ["Customers", "/app/crm/customers", "Who buys from you and how they are doing"],
  ];

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Knowledge base</h1><p>How your firm works, in one place — SOPs, contract terms, policies, answers for clients, templates and lessons. Search is free; “Ask” answers only from your own notes.</p></div>
        {canEdit && <Link href="/app/knowledge?new=1" className="btn sm">+ New note</Link>}</div>
      <div className="panel"><AskBox /></div>
      {(open || editing) && (
        <div className="panel stack-sm">
          {editing ? (
            <><strong>{open ? "Edit note" : "New note"}</strong><ArticleForm a={open || {}} /></>
          ) : (
            <>
              <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div><span className="chip info">{KINDS[open.kind]}</span> <strong style={{ fontSize: 18 }}>{open.title}</strong></div>
                <div className="row" style={{ gap: 6 }}>
                  {canEdit && <Link href={`/app/knowledge?a=${open.id}&edit=1`} className="btn sm ghost">Edit</Link>}
                  {canEdit && <form action={archiveArticle}><input type="hidden" name="id" value={open.id} /><button className="btn sm ghost">Archive</button></form>}
                  <Link href="/app/knowledge" className="btn sm ghost">Close</Link>
                </div>
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{open.body}</div>
              <div className="small faint">{open.tags ? `Tags: ${open.tags} · ` : ""}Updated {new Date(open.updated_at).toLocaleDateString("en-IN")}</div>
            </>
          )}
        </div>
      )}
      <form className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input name="q" defaultValue={q} placeholder="Search your notes" style={{ flex: 1, minWidth: 200 }} />
        <select name="kind" defaultValue={kind || ""}><option value="">All kinds</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn sm ghost">Search</button>
      </form>
      {!all.length && (
        <div className="panel empty-state stack-sm">
          <p className="muted" style={{ margin: 0 }}>No notes yet. Start with six ready ones — bid preparation, client onboarding, payment policy, standard terms, client FAQs and site visits — and edit them to fit your firm.</p>
          {canEdit && <form action={addStarters}><button className="sm">Add the six starter notes</button></form>}
        </div>
      )}
      <div className="stack-sm">
        {hits.map(({ a, snippet }) => (
          <Link key={a.id} href={`/app/knowledge?a=${a.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="panel" style={{ padding: "12px 16px", display: "block" }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{a.pinned && <span className="chip warn">Pinned</span>}<span className="chip plain mute">{KINDS[a.kind]}</span><strong>{a.title}</strong></div>
            <div className="small muted" style={{ marginTop: 4 }}>{snippet}</div>
          </Link>
        ))}
        {all.length > 0 && !hits.length && <p className="small muted">Nothing matches “{q}”. {canEdit && <Link href="/app/knowledge?new=1">Write a note about it</Link>}</p>}
      </div>
      <div className="panel stack-sm">
        <h2 style={{ margin: 0 }}>Also kept for you</h2>
        <div className="conn-grid">{HUB.map(([l, h, d]) => <Link key={h} href={h} className="conn" style={{ gridTemplateColumns: "1fr" }}><span className="small" style={{ fontWeight: 600 }}>{l}</span><span className="faint" style={{ fontSize: 11.5 }}>{d}</span></Link>)}</div>
      </div>
    </div>
  );
}
