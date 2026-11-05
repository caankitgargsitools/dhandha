"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { addComment, removeComment } from "./commentActions";

const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

// Team notes on one tender; tick people under "Tell" to alert them on their phone.
export default function TenderComments({ matchId, comments = [], team = [], me, canPost }) {
  const [state, action, pending] = useActionState(addComment, {});
  const formRef = useRef(null);
  const [, start] = useTransition();
  useEffect(() => { if (state?.at) formRef.current?.reset(); }, [state?.at]);
  const name = (id) => team.find((t) => t.user_id === id)?.name || "Someone";
  return (
    <div className="stack-sm">
      {!comments.length && <p className="small muted" style={{ margin: 0 }}>No notes yet. Use this for questions, decisions and who is doing what on this bid.</p>}
      <ul className="comment-list">
        {comments.map((c) => (
          <li key={c.id}>
            <div className="tiny faint">{name(c.author)} · {when(c.created_at)}{c.mentions?.length ? ` · told ${c.mentions.map(name).join(", ")}` : ""}
              {c.author === me && <> · <button type="button" className="linkish tiny" onClick={() => start(() => removeComment({ id: c.id, matchId }))}>remove</button></>}</div>
            <div className="small" style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
          </li>
        ))}
      </ul>
      {canPost && (
        <form ref={formRef} action={action} className="stack-sm">
          <input type="hidden" name="match_id" value={matchId} />
          <label htmlFor="cbody" className="small">Add a note</label>
          <textarea id="cbody" name="body" rows={2} maxLength={2000} required placeholder="e.g. Solvency certificate asked from the bank — ready by Friday" />
          {team.filter((t) => t.user_id !== me).length > 0 && (
            <fieldset className="row" style={{ border: 0, padding: 0, margin: 0, gap: 10, flexWrap: "wrap" }}>
              <legend className="tiny faint">Tell (phone alert)</legend>
              {team.filter((t) => t.user_id !== me).map((t) => <label key={t.user_id} className="small row" style={{ gap: 4 }}><input type="checkbox" name="tell" value={t.user_id} />{t.name}</label>)}
            </fieldset>
          )}
          {state?.error && <p className="error small" role="alert">{state.error}</p>}
          {state?.message && <p className="success small" role="status">{state.message}</p>}
          <div><button className="sm" aria-busy={pending} disabled={pending}>{pending ? "Posting…" : "Post"}</button></div>
        </form>
      )}
    </div>
  );
}
