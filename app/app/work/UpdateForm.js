"use client";
import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addWorkUpdate } from "./actions";

// Post a site update from the phone: progress, note, crew, photos (straight to the private bucket) and where you are
export default function UpdateForm({ job, tenantId, companyId, last }) {
  const [st, act, pending] = useActionState(addWorkUpdate, {});
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [up, setUp] = useState({});
  const [geo, setGeo] = useState(null);
  async function pick(e) {
    const files = [...(e.target.files || [])].slice(0, 10 - photos.length);
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) { setUp({ error: `${f.name} is over 10 MB.` }); continue; }
      if (!/^image\//.test(f.type)) { setUp({ error: "Photos only (JPG / PNG)." }); continue; }
      setUp({ busy: f.name });
      const path = `${tenantId}/${companyId}/${job.id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_").slice(-60)}`;
      const { error } = await createClient().storage.from("work-photos").upload(path, f, { contentType: f.type, upsert: false });
      if (error) { setUp({ error: error.message }); return; }
      setPhotos((p) => [...p, path]);
    }
    setUp({});
    e.target.value = "";
  }
  function locate() {
    if (!navigator.geolocation) return setGeo({ error: "This phone cannot share its location." });
    setGeo({ busy: true });
    navigator.geolocation.getCurrentPosition((p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setGeo({ error: "Location not allowed." }), { enableHighAccuracy: true, timeout: 15000 });
  }
  if (!open) return <button type="button" className="btn sm" onClick={() => setOpen(true)}>+ Site update</button>;
  return (
    <form action={act} className="stack-sm" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
      <input type="hidden" name="kind" value={job.kind} />
      <input type="hidden" name="id" value={job.id} />
      <input type="hidden" name="photos" value={photos.join("\n")} />
      <input type="hidden" name="lat" value={geo?.lat || ""} />
      <input type="hidden" name="lng" value={geo?.lng || ""} />
      <div className="form-grid">
        <div><label htmlFor={`p-${job.id}`}>Work done (%)</label><input id={`p-${job.id}`} name="progress" type="number" min="0" max="100" inputMode="numeric" defaultValue={last ?? ""} /></div>
        <div><label htmlFor={`c-${job.id}`}>People on site today</label><input id={`c-${job.id}`} name="crew" type="number" min="0" inputMode="numeric" /></div>
        <div><label htmlFor={`n-${job.id}`}>Who (optional)</label><input id={`n-${job.id}`} name="crew_names" placeholder="Ramesh, Suresh + 3 helpers" /></div>
      </div>
      <div><label htmlFor={`t-${job.id}`}>What happened today</label><textarea id={`t-${job.id}`} name="note" rows={2} maxLength={1000} /></div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label className="btn sm ghost" style={{ margin: 0 }}>📷 Add photos<input type="file" accept="image/*" capture="environment" multiple hidden onChange={pick} /></label>
        <button type="button" className="btn sm ghost" onClick={locate} aria-busy={!!geo?.busy}>📍 {geo?.lat ? "Location added" : "Add my location"}</button>
        <label className="small row" style={{ gap: 6, margin: 0 }}><input type="checkbox" name="issue" /> Problem on site (alerts managers)</label>
      </div>
      {photos.length > 0 && <div className="small faint">{photos.length} photo{photos.length === 1 ? "" : "s"} added</div>}
      {up.busy && <div className="small" aria-busy="true">Uploading {up.busy}…</div>}
      {(up.error || geo?.error) && <p className="error small" style={{ margin: 0 }}>{up.error || geo.error}</p>}
      {st?.error && <p className="error small" role="alert" style={{ margin: 0 }}>{st.error}</p>}
      {st?.message && <p className="success small" role="status" style={{ margin: 0 }}>{st.message}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="sm" aria-busy={pending} disabled={pending || !!up.busy}>Save update</button>
        <button type="button" className="btn sm ghost" onClick={() => setOpen(false)}>Close</button>
      </div>
    </form>
  );
}
