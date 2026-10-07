"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordBrandAsset } from "../actions";

// Makes near-white pixels transparent and trims empty borders (for signature / seal photos).
async function cleanBackground(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (lum > 200) px[i + 3] = 0;
    else {
      if (lum > 150) px[i + 3] = Math.round(((200 - lum) / 50) * 255);
      const p = i / 4, x = p % w, y = (p - x) / w;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(data, 0, 0);
  if (maxX <= minX || maxY <= minY) throw new Error("Could not find ink in the photo. Use dark ink on white paper.");
  const pad = 8;
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad) - cx, ch = Math.min(h, maxY + pad) - cy;
  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.getContext("2d").drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return await new Promise((res) => out.toBlob(res, "image/png"));
}

export default function BrandUploader({ tenantId, companyId, kind, accept, clean, margins, current }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [top, setTop] = useState(current?.margin_top_mm ?? 45);
  const [bottom, setBottom] = useState(current?.margin_bottom_mm ?? 25);
  const router = useRouter();

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) return setError("File is larger than 5 MB.");
    setBusy(true);
    try {
      let blob = file, ext = file.name.split(".").pop().toLowerCase(), type = file.type;
      if (clean) { blob = await cleanBackground(file); ext = "png"; type = "image/png"; }
      const path = `${tenantId}/${companyId}/${kind}-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("brand").upload(path, blob, { contentType: type, upsert: false });
      if (upErr) throw upErr;
      const meta = margins ? { margin_top_mm: Number(top), margin_bottom_mm: Number(bottom) } : {};
      const res = await recordBrandAsset({ kind, path, meta });
      if (res?.error) {
        await supabase.storage.from("brand").remove([path]);
        throw new Error(res.error);
      }
      router.refresh();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="stack">
      {margins && (
        <div className="row">
          <div style={{ flex: 1 }}><label>Header height (mm)</label><input type="number" value={top} min={0} max={120} onChange={(e) => setTop(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label>Footer height (mm)</label><input type="number" value={bottom} min={0} max={80} onChange={(e) => setBottom(e.target.value)} /></div>
        </div>
      )}
      <label className="btn ghost" style={{ alignSelf: "start", cursor: busy ? "default" : "pointer", color: "var(--ink)", marginBottom: 0 }}>
        {busy ? "Uploading…" : current !== undefined ? "Replace" : "Upload"}
        <input type="file" accept={accept} onChange={onFile} disabled={busy} style={{ display: "none" }} />
      </label>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
