"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readDocumentAgain, useDocumentValue } from "../../actions";
import { fieldLabel } from "@/lib/docRead";

const show = (field, v) => (/^fin\./.test(field) && Number.isFinite(Number(v)) ? `₹${Number(v).toLocaleString("en-IN")}` : String(v));

// What Dhandha read from one document: details added, values that differ from the Vault, and "Read again".
export default function ReadResult({ doc, canEdit }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const x = doc.extracted || {};
  const run = (fn) => start(async () => { const r = await fn(); setMsg(r?.error ? { error: r.error } : r?.message ? { ok: r.message } : null); router.refresh(); });
  const open = (x.conflicts || []).map((c, i) => ({ ...c, i })).filter((c) => !c.settled);
  const status = { done: "Read", partial: "Read", reading: "Reading…", failed: "Could not read", nothing: "Not read" }[doc.read_status];
  if (doc.read_status === "none" && !doc.storage_path && !doc.drive_file_id) return null;
  return (
    <details className="small" style={{ marginTop: 4 }}>
      <summary style={{ cursor: "pointer" }}>
        <span className={`chip ${doc.read_status === "done" ? "ok" : doc.read_status === "failed" ? "bad" : "mute"}`}>{status || "Not read yet"}{x.lines?.length ? ` · ${x.lines.length} added` : ""}{open.length ? ` · ${open.length} to check` : ""}</span>
      </summary>
      <div className="stack-sm" style={{ padding: "8px 0" }}>
        {x.summary?.length > 0 && <ul style={{ margin: 0, paddingLeft: 18 }}>{x.summary.map((s, i) => <li key={i} className="muted">{s}</li>)}</ul>}
        {x.lines?.length > 0 && <div><strong>Added to your Vault</strong><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{x.lines.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
        {open.length > 0 && (
          <div className="stack-sm">
            <strong>Different from your Vault — kept yours</strong>
            {open.map((c) => (
              <div key={c.i} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span>{fieldLabel(c.field)}{c.period ? ` ${c.period}` : ""}: Vault <b>{show(c.field, c.vault)}</b> · document <b>{show(c.field, c.doc)}</b></span>
                {canEdit && <button type="button" className="ghost sm" disabled={pending} onClick={() => run(() => useDocumentValue(doc.id, c.i))}>Use the document’s</button>}
              </div>
            ))}
          </div>
        )}
        {x.note && <p className="tiny faint" style={{ margin: 0 }}>{x.note}</p>}
        {x.error && <p className="error" style={{ margin: 0 }}>{x.error}</p>}
        {x.engine && <p className="tiny faint" style={{ margin: 0 }}>Read by the {x.engine}{x.at ? ` · ${new Date(x.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}</p>}
        {canEdit && (doc.storage_path || doc.drive_file_id) && <div><button type="button" className="ghost sm" disabled={pending} aria-busy={pending} onClick={() => run(() => readDocumentAgain(doc.id))}>{pending ? "Reading…" : "Read again"}</button></div>}
        {msg?.ok && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>{msg.ok}</p>}
        {msg?.error && <p className="error" style={{ margin: 0 }}>{msg.error}</p>}
      </div>
    </details>
  );
}
