"use client";
import { useState, useTransition } from "react";
import { draftReviewReply, draftProfilePost } from "../googleActions";
import { templateReply, TONES } from "@/lib/reviewReply";
import { Spinner } from "@/components/Progress";

const stars = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
const GBP = "https://business.google.com/reviews";

// Latest Google reviews with a reply draft each (free template, or AI), and a weekly post writer.
export function ReviewReplies({ reviews, business, canWrite }) {
  return (
    <div className="stack-sm">
      {!reviews.length && <p className="small muted" style={{ margin: 0 }}>Google shows no review text yet. Press &ldquo;Refresh from Google&rdquo; above after your next review.</p>}
      {reviews.map((r) => <One key={r.i} r={r} business={business} canWrite={canWrite} />)}
      <p className="tiny faint" style={{ margin: 0 }}>Google shares only your latest few reviews. Copy a reply, then post it in the Google Business Profile app or at business.google.com → Reviews (Dhandha cannot post for you).</p>
    </div>
  );
}

function One({ r, business, canWrite }) {
  const [text, setText] = useState("");
  const [tone, setTone] = useState("warm");
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const ai = () => start(async () => { setNote(null); const x = await draftReviewReply(r.i, tone); if (x.error) setNote(x.error); else { setText(x.reply); if (x.paid) setNote("Written by a paid AI tier · 1 credit"); } });
  return (
    <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
      <div className="small"><strong>{r.author}</strong> <span style={{ color: "var(--marigold)" }}>{stars(r.rating)}</span> <span className="tiny faint">{r.when}</span></div>
      {r.text && <p className="small" style={{ margin: "4px 0" }}>{r.text}</p>}
      {canWrite && (text ? (
        <div className="stack-sm">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="sm" onClick={() => navigator.clipboard?.writeText(text)}>Copy</button>
            <a className="btn sm ghost" href={GBP} target="_blank" rel="noreferrer">Reply on Google</a>
            <button type="button" className="sm ghost" onClick={() => setText("")}>Start again</button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="sm ghost" onClick={() => setText(templateReply(r, business))}>Quick reply (free)</button>
          <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ width: "auto" }} aria-label="Tone">{Object.entries(TONES).map(([k, l]) => <option key={k} value={k}>{l.split(" (")[0]}</option>)}</select>
          <button type="button" className="sm" onClick={ai} disabled={pending} aria-busy={pending}>Write with AI</button>
        </div>
      ))}
      {pending && <Spinner label="Writing…" />}
      {note && <p className="tiny faint" style={{ margin: "4px 0 0" }}>{note}</p>}
    </div>
  );
}

export function PostWriter() {
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState("update");
  const [res, setRes] = useState(null);
  const [pending, start] = useTransition();
  const go = () => start(async () => setRes(await draftProfilePost(topic, kind)));
  return (
    <div className="stack-sm">
      <div className="row" style={{ gap: 6, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 260px" }}><label htmlFor="gp-topic">What is this week&apos;s post about?</label><input id="gp-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={500} placeholder="e.g. Last date for GST annual return is near — we file in 2 days" /></div>
        <div><label htmlFor="gp-kind">Kind</label><select id="gp-kind" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: "auto" }}><option value="update">Update</option><option value="offer">Offer</option><option value="event">Event</option></select></div>
        <button type="button" onClick={go} disabled={pending || topic.trim().length < 5} aria-busy={pending}>Write the post</button>
      </div>
      {pending && <Spinner label="Writing…" />}
      {res?.error && <p className="error small" style={{ margin: 0 }}>{res.error}</p>}
      {res?.post && (
        <div className="stack-sm">
          <textarea rows={5} defaultValue={res.post} id="gp-out" maxLength={1500} />
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="sm" onClick={() => navigator.clipboard?.writeText(document.getElementById("gp-out").value)}>Copy</button>
            <a className="btn sm ghost" href="https://business.google.com/posts" target="_blank" rel="noreferrer">Post on Google</a>
            <span className="tiny faint">Suggested button: {res.button === "BOOK" ? "Book" : res.button === "LEARN_MORE" ? "Learn more" : "Call now"}{res.paid ? " · 1 credit" : " · free"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
