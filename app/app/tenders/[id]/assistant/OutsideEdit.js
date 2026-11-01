"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { openOutside, syncOutside, uploadFilled } from "../../outsideActions";
import { MAX_UPLOAD } from "@/lib/gdocs";


// Fill a big format where people are comfortable: Google Docs / Google Sheets (in the workspace's own Drive; what is
// saved there comes back when they return to this page), or Word / Excel (download, fill, upload the file back).
export default function OutsideEdit({ matchId, f, google, onMessage }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const say = (m, error) => onMessage?.(m, error);
  const open = async (kind) => {
    // the tab opens straight away (browsers block a window opened after a wait), then goes to the file
    const w = window.open("", "_blank");
    setBusy(kind);
    const r = await openOutside({ matchId, idx: f.idx, kind });
    setBusy(null);
    if (r?.error) { w?.close(); say(r.error, true); return; }
    if (w) w.location.href = r.url; else window.location.href = r.url;
    say(`“${f.title}” is open in Google ${kind === "sheet" ? "Sheets" : "Docs"}. Fill it there — it saves by itself; when you come back here it is brought into Dhandha.`);
    router.refresh();
  };
  const pull = async () => {
    setBusy("pull");
    const r = await syncOutside({ matchId });
    setBusy(null);
    if (r?.error) return say(r.error, true);
    say(r.changed ? `Brought back ${r.changed} format${r.changed === 1 ? "" : "s"} from Google.` : "Nothing new in Google yet.");
    if (r.errors?.length) say(r.errors.join("; "), true);
    router.refresh();
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // server actions take at most 4 MB (next.config.js bodySizeLimit); a bigger file would fail without a message
    if (file.size > MAX_UPLOAD) { e.target.value = ""; return say("That file is over 3.5 MB. Save it without pictures (or as .docx / .xlsx) and upload again.", true); }
    const fd = new FormData();
    fd.append("match_id", matchId); fd.append("idx", String(f.idx)); fd.append("file", file);
    setBusy("upload");
    let r;
    try { r = await uploadFilled(fd); } catch { r = { error: "The upload did not go through. Try again." }; } finally { setBusy(null); e.target.value = ""; }
    if (r?.error) return say(r.error, true);
    say(r.message);
    router.refresh();
  };
  const base = `/api/formats/file?match=${encodeURIComponent(matchId)}&idx=${f.idx}`;
  return (
    <div className="stack-sm" style={{ marginTop: 8 }}>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <span className="tiny faint">Fill it in:</span>
        {google?.ready && google?.connected && <>
          <button type="button" className={f.sheetFirst ? "ghost sm" : "sm"} aria-busy={busy === "doc"} disabled={!!busy} onClick={() => open("doc")}>Google Docs</button>
          {f.hasTable && <button type="button" className={f.sheetFirst ? "sm" : "ghost sm"} aria-busy={busy === "sheet"} disabled={!!busy} onClick={() => open("sheet")}>Google Sheets (tables)</button>}
        </>}
        <a className="btn ghost sm" href={`${base}&as=word`}>Word</a>
        {f.hasTable && <a className="btn ghost sm" href={`${base}&as=excel`}>Excel (tables)</a>}
        <label className="btn ghost sm" style={{ cursor: "pointer" }} aria-busy={busy === "upload"}>
          Upload filled file<input type="file" accept=".docx,.doc,.xlsx,.csv,.txt" onChange={upload} disabled={!!busy} style={{ display: "none" }} />
        </label>
      </div>
      {google?.ready && !google?.connected && <div className="tiny faint">To fill formats in Google Docs or Sheets, <a href="/app/settings/drive">connect your Google Drive</a> once.</div>}
      {f.gdoc && (
        <div className="tiny faint">
          Linked to <a href={f.gdoc.url} target="_blank" rel="noreferrer">Google {f.gdoc.kind === "sheet" ? "Sheets" : "Docs"}</a>
          {f.gdoc.pulled ? ` · brought back ${new Date(f.gdoc.pulled).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : " · nothing brought back yet"}
          {" · "}<button type="button" className="ghost sm" aria-busy={busy === "pull"} disabled={!!busy} onClick={pull}>Bring back now</button>
        </div>
      )}
      {f.outside && <div className="tiny faint">Filled from your {f.outside.via} file on {new Date(f.outside.at).toLocaleDateString("en-IN")}.</div>}
    </div>
  );
}
