"use client";
import { useActionState } from "react";
import { saveArticle } from "./actions";
import { KINDS } from "@/lib/knowledge";

export default function ArticleForm({ a = {} }) {
  const [st, act, pending] = useActionState(saveArticle, {});
  return (
    <form action={act} className="stack-sm">
      {a.id && <input type="hidden" name="id" value={a.id} />}
      <div className="form-grid">
        <div style={{ gridColumn: "span 2" }}><label htmlFor="kt">Title</label><input id="kt" name="title" defaultValue={a.title || ""} required /></div>
        <div><label htmlFor="kk">Kind</label><select id="kk" name="kind" defaultValue={a.kind || "sop"}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <div><label htmlFor="kb">Note</label><textarea id="kb" name="body" rows={12} defaultValue={a.body || ""} placeholder="Steps, terms, answers — write it the way you would tell a new team member." /></div>
      <div className="form-grid">
        <div><label htmlFor="kg">Tags</label><input id="kg" name="tags" defaultValue={a.tags || ""} placeholder="payment, invoice" /></div>
        <label className="small row" style={{ gap: 6, alignSelf: "end" }}><input type="checkbox" name="pinned" defaultChecked={!!a.pinned} /> Pin to the top</label>
      </div>
      {st?.error && <p className="error small" role="alert">{st.error}</p>}
      <div><button className="sm" aria-busy={pending} disabled={pending}>Save note</button></div>
    </form>
  );
}
