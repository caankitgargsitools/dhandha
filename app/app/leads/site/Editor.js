"use client";
import { useState, useTransition } from "react";
import { saveSite, writeSiteText } from "./actions";
import { Spinner } from "@/components/Progress";

// The website editor: every field on one form, saved together. "Write the texts for me" fills them with AI.
export default function Editor({ initial, origin, aiCost }) {
  const [s, setS] = useState(initial);
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const setSvc = (i, k, v) => setS((x) => ({ ...x, services: x.services.map((y, j) => (j === i ? { ...y, [k]: v } : y)) }));
  const save = (published) => start(async () => { setNote(null); const r = await saveSite({ ...s, published }); if (r.error) setNote({ bad: r.error }); else { setS((x) => ({ ...x, slug: r.slug, published })); setNote({ ok: published ? "Published." : "Saved (not public)." }); } });
  const ai = () => start(async () => { setNote(null); const r = await writeSiteText({ services: s.services }); if (r.error) setNote({ bad: r.error }); else { setS((x) => ({ ...x, ...r.text, services: r.text.services.length ? r.text.services : x.services })); setNote({ ok: "Texts written — read them, change anything, then save." }); } });
  const url = `${origin}/s/${s.slug}`;
  return (
    <div className="stack">
      <div className="panel stack-sm">
        <div className="row between"><h3 style={{ margin: 0 }}>Your website</h3><span className={`chip ${s.published ? "ok" : "mute"}`}>{s.published ? "Live" : "Not published"}</span></div>
        <div><label htmlFor="s-slug">Web address</label><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}><span className="small faint" style={{ whiteSpace: "nowrap" }}>{origin}/s/</span><input id="s-slug" value={s.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} maxLength={40} /></div></div>
        {s.published && <div className="row" style={{ gap: 6 }}><a className="btn sm ghost" href={url} target="_blank" rel="noreferrer">Open my website</a><button type="button" className="sm ghost" onClick={() => navigator.clipboard?.writeText(url)}>Copy link</button></div>}
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="ghost sm" onClick={ai} disabled={pending}>Write the texts for me (AI · {aiCost} credits)</button>
        </div>
      </div>
      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>Top of the page</h3>
        <div><label htmlFor="s-h">Headline</label><input id="s-h" value={s.headline || ""} onChange={(e) => set("headline", e.target.value)} maxLength={120} /></div>
        <div><label htmlFor="s-t">One line under it</label><input id="s-t" value={s.tagline || ""} onChange={(e) => set("tagline", e.target.value)} maxLength={240} /></div>
        <div style={{ maxWidth: 120 }}><label htmlFor="s-c">Colour</label><input id="s-c" type="color" value={s.color} onChange={(e) => set("color", e.target.value)} style={{ height: 40, padding: 2 }} /></div>
      </div>
      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>Services</h3>
        {s.services.map((x, i) => (
          <div key={i} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input value={x.title} onChange={(e) => setSvc(i, "title", e.target.value)} placeholder="Service" maxLength={80} style={{ flex: "1 1 30%" }} />
            <input value={x.text} onChange={(e) => setSvc(i, "text", e.target.value)} placeholder="One line about it (optional)" maxLength={300} style={{ flex: "2 1 60%" }} />
            <button type="button" className="sm ghost" aria-label="Remove" onClick={() => set("services", s.services.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        {s.services.length < 24 && <div><button type="button" className="sm ghost" onClick={() => set("services", [...s.services, { title: "", text: "" }])}>+ Add a service</button></div>}
      </div>
      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>About us</h3>
        <textarea rows={5} value={s.about || ""} onChange={(e) => set("about", e.target.value)} maxLength={2000} />
        <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={s.show_work} onChange={(e) => set("show_work", e.target.checked)} style={{ width: "auto" }} />Show completed works from the Vault (client, work, year — no values)</label>
        <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={s.show_people} onChange={(e) => set("show_people", e.target.checked)} style={{ width: "auto" }} />Show key people (name, designation, qualification)</label>
      </div>
      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>Contact</h3>
        <div className="form-grid">
          <div><label htmlFor="s-p">Phone</label><input id="s-p" value={s.phone || ""} onChange={(e) => set("phone", e.target.value)} maxLength={20} /></div>
          <div><label htmlFor="s-w">WhatsApp</label><input id="s-w" value={s.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} maxLength={20} /></div>
          <div><label htmlFor="s-e">Email</label><input id="s-e" value={s.email || ""} onChange={(e) => set("email", e.target.value)} maxLength={200} /></div>
        </div>
        <div><label htmlFor="s-a">Address</label><input id="s-a" value={s.address || ""} onChange={(e) => set("address", e.target.value)} maxLength={400} /></div>
        <p className="tiny faint" style={{ margin: 0 }}>The page has your enquiry form built in — every enquiry lands in Leads with a phone alert.</p>
      </div>
      <details className="panel">
        <summary><strong>Google search text</strong> <span className="small muted">— what Google shows for your page</span></summary>
        <div className="stack-sm" style={{ marginTop: 8 }}>
          <div><label htmlFor="s-st">Title ({(s.seo_title || "").length}/60)</label><input id="s-st" value={s.seo_title || ""} onChange={(e) => set("seo_title", e.target.value)} maxLength={70} /></div>
          <div><label htmlFor="s-sd">Description ({(s.seo_description || "").length}/155)</label><textarea id="s-sd" rows={2} value={s.seo_description || ""} onChange={(e) => set("seo_description", e.target.value)} maxLength={170} /></div>
        </div>
      </details>
      <div className="row" style={{ gap: 8, position: "sticky", bottom: 0, background: "var(--bg)", padding: "10px 0" }}>
        <button type="button" onClick={() => save(true)} disabled={pending} aria-busy={pending}>{s.published ? "Save & keep live" : "Publish"}</button>
        <button type="button" className="ghost" onClick={() => save(false)} disabled={pending}>{s.published ? "Take offline" : "Save without publishing"}</button>
        {pending && <Spinner label="Working…" />}
        {note?.bad && <span className="error small">{note.bad}</span>}
        {note?.ok && <span className="small" style={{ color: "var(--ok)" }}>{note.ok}</span>}
      </div>
    </div>
  );
}
