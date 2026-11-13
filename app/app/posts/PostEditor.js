"use client";
import { useActionState, useState, useTransition } from "react";
import { savePost, aiWritePost, setPostStatus } from "./actions";
import { CHANNELS, THEMES, postText, shareLink, tooLong } from "@/lib/contentPlan";

// one post: edit, rewrite with AI, copy / share, mark posted or skip
export default function PostEditor({ p, canEdit, day }) {
  const [st, act, pending] = useActionState(savePost, {});
  const [d, setD] = useState({ title: p?.title || "", body: p?.body || "", hashtags: p?.hashtags || "", channel: p?.channel || "google", theme: p?.theme || "tip", post_on: p?.post_on || day });
  const [hint, setHint] = useState("");
  const [ai, setAi] = useState({});
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const over = tooLong(d), share = shareLink(d);
  const rewrite = () => start(async () => {
    setAi({});
    const r = await aiWritePost(p.id, hint);
    if (r.error) return setAi({ error: r.error });
    setD((x) => ({ ...x, title: r.title || x.title, body: r.body, hashtags: r.hashtags || x.hashtags }));
    setAi({ message: r.paid ? "Written by AI (1 credit)." : "Written by AI (free)." });
  });
  return (
    <div className="stack-sm">
      <form action={act} className="stack-sm">
        {p?.id && <input type="hidden" name="id" value={p.id} />}
        <div className="form-grid">
          <div><label>Date</label><input type="date" name="post_on" value={d.post_on} onChange={(e) => setD({ ...d, post_on: e.target.value })} disabled={!canEdit} /></div>
          <div><label>Where</label><select name="channel" value={d.channel} onChange={(e) => setD({ ...d, channel: e.target.value })} disabled={!canEdit}>{Object.entries(CHANNELS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></div>
          <div><label>About</label><select name="theme" value={d.theme} onChange={(e) => setD({ ...d, theme: e.target.value })} disabled={!canEdit}>{Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
        </div>
        <div><label>Title</label><input name="title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} disabled={!canEdit} /></div>
        <div><label>Post</label><textarea name="body" rows={5} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} disabled={!canEdit} /></div>
        <div><label>Hashtags</label><input name="hashtags" value={d.hashtags} onChange={(e) => setD({ ...d, hashtags: e.target.value })} disabled={!canEdit} /></div>
        <div className="small faint">{postText(d).length} / {CHANNELS[d.channel].max} characters{over ? <span style={{ color: "var(--blood)" }}> — {over} too long for {CHANNELS[d.channel].label}</span> : null}</div>
        {st?.error && <p className="error small" role="alert">{st.error}</p>}
        {st?.message && <p className="success small" role="status">{st.message}</p>}
        {canEdit && <div><button className="sm" aria-busy={pending} disabled={pending}>Save</button></div>}
      </form>
      {p?.id && canEdit && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Direction for AI (optional), e.g. mention our new office" style={{ flex: 1, minWidth: 200 }} />
          <button type="button" className="btn sm ghost" onClick={rewrite} aria-busy={busy} disabled={busy}>✨ Rewrite with AI (free tier first, else 1 credit)</button>
        </div>
      )}
      {ai.error && <p className="error small">{ai.error}</p>}
      {ai.message && <p className="success small">{ai.message} Press Save to keep it.</p>}
      {p?.id && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn sm ghost" onClick={() => { navigator.clipboard?.writeText(postText(d)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "✓ Copied" : "Copy text"}</button>
          {share && <a className="btn sm ghost" href={share} target="_blank" rel="noreferrer">Open in {CHANNELS[d.channel].label}</a>}
          {canEdit && ["posted", "skipped"].map((s) => (
            <form key={s} action={setPostStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={s} /><button className="btn sm ghost">{s === "posted" ? "✓ Mark posted" : "Skip"}</button></form>
          ))}
          {canEdit && <form action={setPostStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="skipped" /><input type="hidden" name="archive" value="1" /><button className="btn sm ghost">Remove</button></form>}
        </div>
      )}
    </div>
  );
}
