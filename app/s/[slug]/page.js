import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { anonClient } from "@/lib/supabase/anon";
import { jsonLd, telHref } from "@/lib/site";
import EnquiryForm from "../../f/[token]/EnquiryForm";

// A business's one-page website (built at Generate leads → Your website). Public, no login.
async function load(slug, count) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug || "")) return null;
  const { data } = await anonClient().rpc("site_view", { p_slug: slug, p_count: count });
  return data;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const s = await load(slug, false);
  if (!s) return { title: "Not found" };
  return { title: { absolute: s.seo_title || s.name }, description: s.seo_description || s.tagline || undefined, openGraph: { title: s.seo_title || s.name, description: s.seo_description || s.tagline || undefined, type: "website" } };
}

export default async function Site({ params }) {
  const { slug } = await params;
  const s = await load(slug, true);
  if (!s) notFound();
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}/s/${s.slug}`;
  const tel = telHref(s.phone);
  const wa = s.whatsapp ? `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(`Hello ${s.name}, I have a question.`)}` : null;
  const accent = s.color || "#4f46e5";
  const wrap = { maxWidth: 1040, margin: "0 auto", padding: "0 20px" };
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(s, url)).replace(/</g, "\\u003c") }} />
      <header style={{ background: accent, color: "#fff", padding: "56px 0 48px" }}>
        <div style={wrap}>
          <div style={{ fontSize: 14, opacity: 0.85 }}>{s.name}{s.city ? ` · ${s.city}` : ""}</div>
          <h1 style={{ color: "#fff", fontSize: "clamp(28px, 5vw, 44px)", margin: "8px 0", lineHeight: 1.15 }}>{s.headline || s.name}</h1>
          {s.tagline && <p style={{ fontSize: 18, opacity: 0.92, margin: 0, maxWidth: 680 }}>{s.tagline}</p>}
          <div className="row" style={{ gap: 10, marginTop: 22 }}>
            {tel && <a href={tel} className="btn" style={{ background: "#fff", color: accent }}>Call us</a>}
            {wa && <a href={wa} className="btn" style={{ background: "#16a34a", color: "#fff" }} target="_blank" rel="noreferrer">WhatsApp</a>}
            {s.widget && <a href="#enquire" className="btn ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.6)" }}>Send an enquiry</a>}
          </div>
        </div>
      </header>

      <main style={{ ...wrap, padding: "36px 20px" }} className="stack">
        {s.services?.length > 0 && (
          <section className="stack-sm">
            <h2 style={{ margin: 0 }}>What we do</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {s.services.map((x, i) => <div key={i} className="panel" style={{ margin: 0, borderTop: `3px solid ${accent}` }}><strong>{x.title}</strong>{x.text && <p className="small muted" style={{ margin: "6px 0 0" }}>{x.text}</p>}</div>)}
            </div>
          </section>
        )}
        {s.about && <section className="stack-sm"><h2 style={{ margin: 0 }}>About us</h2><p style={{ whiteSpace: "pre-line", margin: 0, maxWidth: 760 }}>{s.about}</p>{s.since ? <p className="small muted" style={{ margin: 0 }}>Working since {s.since}.</p> : null}</section>}
        {s.works?.length > 0 && (
          <section className="stack-sm">
            <h2 style={{ margin: 0 }}>Work we have completed</h2>
            <div className="panel flush"><table><tbody>{s.works.map((w, i) => <tr key={i}><td><strong>{w.work}</strong><div className="tiny faint">{w.client}</div></td><td className="small" style={{ textAlign: "right" }}>{w.year || ""}</td></tr>)}</tbody></table></div>
          </section>
        )}
        {s.people?.length > 0 && (
          <section className="stack-sm">
            <h2 style={{ margin: 0 }}>Our team</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
              {s.people.map((p, i) => <div key={i} className="panel" style={{ margin: 0 }}><strong>{p.name}</strong><div className="small muted">{[p.designation, p.qualification].filter(Boolean).join(" · ")}</div></div>)}
            </div>
          </section>
        )}
        <section id="enquire" className="grid-2" style={{ alignItems: "start" }}>
          <div className="stack-sm">
            <h2 style={{ margin: 0 }}>Contact us</h2>
            {s.phone && <div>Phone: {tel ? <a href={tel}>{s.phone}</a> : s.phone}</div>}
            {s.email && <div>Email: <a href={`mailto:${s.email}`}>{s.email}</a></div>}
            {s.address && <div>Address: <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`} target="_blank" rel="noreferrer">{s.address}</a></div>}
            {wa && <div><a className="btn ghost sm" href={wa} target="_blank" rel="noreferrer">Chat on WhatsApp</a></div>}
          </div>
          {s.widget && <div className="panel stack-sm" style={{ margin: 0 }}><h3 style={{ margin: 0 }}>Send an enquiry</h3><EnquiryForm token={s.widget} askEmail /></div>}
        </section>
      </main>
      <footer className="tiny faint" style={{ textAlign: "center", padding: "24px 0" }}>© {new Date().getFullYear()} {s.name} · Made with Dhandha</footer>
    </div>
  );
}
