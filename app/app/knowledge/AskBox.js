"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { askKb } from "./actions";

export default function AskBox() {
  const [q, setQ] = useState("");
  const [r, setR] = useState(null);
  const [busy, start] = useTransition();
  return (
    <div className="stack-sm">
      <form onSubmit={(e) => { e.preventDefault(); start(async () => setR(await askKb(q))); }} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask, e.g. When do we chase an unpaid invoice?" style={{ flex: 1, minWidth: 220 }} />
        <button className="sm" aria-busy={busy} disabled={busy || q.trim().length < 4}>Ask · 2 credits</button>
      </form>
      {r?.error && <p className="error small">{r.error}</p>}
      {r?.answer && (
        <div className="notice info small" style={{ margin: 0, display: "block" }}>
          <div style={{ whiteSpace: "pre-wrap" }}>{r.answer}</div>
          {r.used?.length > 0 && <div className="faint" style={{ marginTop: 6 }}>From: {r.used.map((u, i) => <span key={u.id}>{i ? ", " : ""}<Link href={`/app/knowledge?a=${u.id}`}>{u.title}</Link></span>)}</div>}
        </div>
      )}
    </div>
  );
}
