"use client";
import { useState } from "react";
import { startDriveUpload, finishDriveUpload } from "@/app/app/vault/driveActions";

// Picks a file, sends it straight to the workspace's Google Drive and fills drive_url / drive_file_id for the form.
export default function DriveUpload() {
  const [st, setSt] = useState({});
  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSt({ busy: true, pct: 0, name: file.name });
    const s = await startDriveUpload({ name: file.name, type: file.type, size: file.size });
    if (s.error) return setSt({ error: s.error });
    const id = await new Promise((resolve) => {
      const x = new XMLHttpRequest();
      x.open("PUT", s.uploadUrl);
      x.upload.onprogress = (ev) => ev.lengthComputable && setSt((o) => ({ ...o, pct: Math.round((ev.loaded / ev.total) * 100) }));
      x.onload = () => { try { resolve(x.status < 300 ? JSON.parse(x.responseText).id : null); } catch { resolve(null); } };
      x.onerror = () => resolve(null);
      x.send(file);
    });
    if (!id) return setSt({ error: "Upload to Google Drive failed. Try again." });
    const f = await finishDriveUpload(id);
    if (f.error) return setSt({ error: f.error });
    setSt({ done: true, id: f.id, url: f.url, name: f.name });
  }
  return (
    <div className="stack-sm">
      <label htmlFor="drive_file">Upload the file to your Google Drive</label>
      <input id="drive_file" type="file" onChange={pick} disabled={st.busy} />
      {st.busy && <p className="small" style={{ margin: 0 }}>Uploading {st.name}… {st.pct}%</p>}
      {st.error && <p className="error" style={{ margin: 0 }}>{st.error}</p>}
      {st.done && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>Saved to Drive: <a href={st.url} target="_blank" rel="noreferrer">{st.name}</a></p>}
      <input type="hidden" name="drive_url" value={st.url || ""} />
      <input type="hidden" name="drive_file_id" value={st.id || ""} />
    </div>
  );
}
