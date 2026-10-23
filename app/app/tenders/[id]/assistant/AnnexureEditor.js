"use client";
import { useState } from "react";

// One annexure as a form: the tender's wording, pre-filled from the masters. Yellow boxes are what is still missing;
// tables (partners / staff, experience) take more rows, and new rows can go into the Vault too. Any wording can be
// changed, and a paragraph added at the end.
export default function AnnexureEditor({ title, segments: initial, busy, onSave, onCancel }) {
  const [segs, setSegs] = useState(() => initial.map((s) => (s.t === "table" ? { ...s, rows: s.rows.map((r) => [...r]), newRows: [], save: s.kind !== "other" } : { ...s })));
  const [extra, setExtra] = useState("");
  const set = (i, patch) => setSegs((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const cellSet = (i, r, c, v) => setSegs((l) => l.map((s, j) => (j === i ? { ...s, rows: s.rows.map((row, k) => (k === r ? row.map((x, m) => (m === c ? v : x)) : row)) } : s)));
  const addRow = (i) => setSegs((l) => l.map((s, j) => (j === i ? { ...s, rows: [...s.rows, s.cols.map(() => "")], newRows: [...s.newRows, s.rows.length] } : s)));
  const dropRow = (i, r) => setSegs((l) => l.map((s, j) => (j === i ? { ...s, rows: s.rows.filter((_, k) => k !== r), newRows: s.newRows.filter((k) => k !== r).map((k) => (k > r ? k - 1 : k)) } : s)));
  const missing = segs.filter((s) => s.t === "field" && !String(s.value || "").trim()).length;
  const save = () => onSave(extra.trim() ? [...segs, { t: "text", v: `\n${extra.trim()}\n` }] : segs);

  return (
    <div className="stack-sm" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
      <div className="row between"><strong>{title}</strong><span className={`chip ${missing ? "warn" : "ok"}`}>{missing ? `${missing} to fill` : "Complete"}</span></div>
      <div style={{ fontSize: 14, lineHeight: 1.7 }}>
        {segs.map((s, i) => {
          if (s.t === "text") return <span key={i} contentEditable suppressContentEditableWarning onBlur={(e) => set(i, { v: e.currentTarget.innerText })} style={{ whiteSpace: "pre-wrap", outline: "none" }}>{s.v}</span>;
          if (s.t === "field") return (
            <input key={i} value={s.value || ""} onChange={(e) => set(i, { value: e.target.value })} placeholder={s.label} title={s.label} aria-label={s.label}
              style={{ display: "inline-block", width: `${Math.min(Math.max((s.value || s.label).length + 2, 12), 48)}ch`, padding: "2px 6px", margin: "0 2px", fontSize: 14, background: s.value ? "rgba(46,125,50,.06)" : "#fff7d6", border: `1px solid ${s.value ? "var(--line)" : "var(--marigold)"}`, borderRadius: 6 }} />
          );
          return (
            <div key={i} className="stack-sm" style={{ margin: "10px 0" }}>
              {s.label && <div className="tiny faint">{s.label.replace(/^complete (the )?table with /i, "Table: ")} — from your {s.kind === "people" ? "Key people" : s.kind === "works" ? "Experience" : "form"}</div>}
              <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 8 }}>
                <table style={{ fontSize: 13 }}>
                  <thead><tr><th style={{ width: 28 }}>#</th>{s.cols.map((c) => <th key={c}>{c}</th>)}<th /></tr></thead>
                  <tbody>
                    {!s.rows.length && <tr><td colSpan={s.cols.length + 2} className="muted small">No rows yet — add one.</td></tr>}
                    {s.rows.map((row, r) => (
                      <tr key={r} style={s.newRows.includes(r) ? { background: "#fffbea" } : undefined}>
                        <td className="tiny faint">{r + 1}</td>
                        {s.cols.map((c, ci) => <td key={ci} style={{ padding: 4 }}><input value={row[ci] || ""} onChange={(e) => cellSet(i, r, ci, e.target.value)} aria-label={`${c}, row ${r + 1}`} style={{ padding: "4px 6px", fontSize: 13, minWidth: 90 }} /></td>)}
                        <td style={{ padding: 4 }}><button type="button" className="ghost sm" onClick={() => dropRow(i, r)} aria-label={`Remove row ${r + 1}`}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button type="button" className="ghost sm" onClick={() => addRow(i)}>+ Add a row</button>
                {s.kind !== "other" && s.newRows.length > 0 && (
                  <label className="row tiny" style={{ gap: 6, margin: 0 }}><input type="checkbox" checked={s.save} onChange={(e) => set(i, { save: e.target.checked })} style={{ width: "auto" }} />Also save new rows to my {s.kind === "people" ? "Key people" : "Experience"}</label>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <label htmlFor="ax-extra" className="tiny">Add something to this annexure (optional)</label>
        <textarea id="ax-extra" rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Another paragraph, a note, a detail…" />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button disabled={busy} onClick={save}>{busy ? "Saving…" : missing ? `Save (${missing} still blank)` : "Save this annexure"}</button>
        {onCancel && <button type="button" className="ghost" disabled={busy} onClick={onCancel}>Close</button>}
        <span className="tiny faint">You can edit any wording — tap the text.</span>
      </div>
    </div>
  );
}
