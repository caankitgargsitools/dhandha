"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendReply, markRead } from "./actions";
import { windowLeft } from "@/lib/outreach";

const TICK = { queued: "🕓", sending: "🕓", sent: "✓", delivered: "✓✓", read: "✓✓ read", failed: "⚠ not sent" };
const time = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

// One conversation: messages (refreshed every few seconds), and the reply box — free text while WhatsApp's 24-hour
// window is open, otherwise an approved template.
export default function Chat({ thread, messages, canSend }) {
  const router = useRouter();
  const box = useRef(null);
  const [text, setText] = useState("");
  const [tpl, setTpl] = useState({ name: "", lang: "en" });
  const [err, setErr] = useState(null);
  const [pending, start] = useTransition();
  const left = windowLeft(thread.last_in_at);

  useEffect(() => { if (thread.unread) markRead(thread.id); }, [thread.id, thread.unread]);
  useEffect(() => { const t = setInterval(() => router.refresh(), 8000); return () => clearInterval(t); }, [router]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);

  const send = (useTemplate) => start(async () => {
    setErr(null);
    const r = await sendReply(thread.id, useTemplate ? "" : text, useTemplate ? tpl.name : null, tpl.lang);
    if (r.error) setErr(r.error); else { setText(""); router.refresh(); }
  });

  return (
    <div className="stack-sm">
      <div ref={box} className="stack-sm" style={{ maxHeight: "58vh", overflowY: "auto", padding: 4 }}>
        {!messages.length && <p className="muted small">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.direction === "in" ? "flex-start" : "flex-end", maxWidth: "80%" }}>
            <div className="panel" style={{ padding: "8px 12px", margin: 0, background: m.direction === "in" ? "var(--panel)" : "var(--primary-soft)", whiteSpace: "pre-wrap" }}>{m.body}</div>
            <div className="tiny faint" style={{ textAlign: m.direction === "in" ? "left" : "right" }}>
              {time(m.created_at)}{m.direction === "out" ? ` · ${m.auto ? "auto-reply · " : ""}${TICK[m.status] || m.status}` : ""}{m.error ? ` — ${m.error}` : ""}
            </div>
          </div>
        ))}
      </div>
      {canSend && (left > 0 ? (
        <div className="stack-sm">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Type your reply…"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) send(false); }} />
          <div className="row" style={{ gap: 10 }}>
            <button type="button" onClick={() => send(false)} disabled={pending || !text.trim()} aria-busy={pending}>Send on WhatsApp</button>
            <span className="tiny faint">Free replies allowed for {Math.floor(left / 3600e3)} h {Math.floor((left % 3600e3) / 60e3)} min more (WhatsApp's 24-hour rule). Ctrl+Enter sends.</span>
          </div>
        </div>
      ) : (
        <div className="stack-sm">
          <p className="small notice" style={{ margin: 0 }}>More than 24 hours since the client last wrote. WhatsApp allows only an approved template now ({"{{1}}"} = first name, {"{{2}}"} = your company).</p>
          <div className="row" style={{ gap: 8 }}>
            <input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value.toLowerCase() })} placeholder="Template name, e.g. follow_up" style={{ maxWidth: 260 }} />
            <input value={tpl.lang} onChange={(e) => setTpl({ ...tpl, lang: e.target.value })} placeholder="en / hi" style={{ width: 80 }} />
            <button type="button" onClick={() => send(true)} disabled={pending || !tpl.name.trim()} aria-busy={pending}>Send template</button>
          </div>
        </div>
      ))}
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}
