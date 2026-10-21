"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { answerQuestion } from "./questionActions";

// Questions Dhandha has after reading tenders: one card per question, however many tenders ask it.
export default function QuestionCards({ questions, canAnswer }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(() => new Set());
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const list = questions.filter((q) => !hidden.has(q.key)).slice(0, 6);
  if (!list.length) return msg ? <p className="success small">{msg}</p> : null;
  async function answer(q, value) {
    setBusy(q.key); setMsg("");
    const r = await answerQuestion({ key: q.key, value, label: q.label });
    setBusy(null);
    if (r?.error) { setMsg(r.error); return; }
    setHidden((h) => new Set(h).add(q.key));
    setMsg(value === "yes" ? `Saved to your Vault. ${q.tenders.length} tender${q.tenders.length === 1 ? "" : "s"} now count${q.tenders.length === 1 ? "s" : ""} “${q.label}” as met.` : "Saved. Tenders that require this are marked not eligible.");
    router.refresh();
  }
  return (
    <div className="panel stack-sm" style={{ borderLeft: "4px solid var(--marigold)" }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h3>Dhandha has {questions.length} question{questions.length === 1 ? "" : "s"} for you</h3>
        <span className="tiny faint">Answer once — saved in your Vault for every tender</span>
      </div>
      {list.map((q) => (
        <div key={q.key} className="row between" style={{ gap: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <strong>{q.question}</strong>
            <div className="tiny faint">
              Needed by {q.tenders.length} tender{q.tenders.length === 1 ? "" : "s"}: {q.tenders.slice(0, 2).map((t, i) => <span key={t.match_id}>{i ? "; " : ""}<Link href={`/app/tenders/${t.match_id}/assistant`}>{t.title.slice(0, 60)}</Link></span>)}{q.tenders.length > 2 ? ` and ${q.tenders.length - 2} more` : ""}
            </div>
          </div>
          {canAnswer && (
            <div className="row" style={{ gap: 6 }}>
              <button className="sm" disabled={busy === q.key} onClick={() => answer(q, "yes")}>Yes</button>
              <button className="sm ghost" disabled={busy === q.key} onClick={() => answer(q, "no")}>No</button>
              <button className="sm ghost" disabled={busy === q.key} onClick={() => setHidden((h) => new Set(h).add(q.key))}>Skip</button>
            </div>
          )}
        </div>
      ))}
      {msg && <p className="success small" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}
