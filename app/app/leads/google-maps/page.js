import { getContext } from "@/lib/session";
import { placesSearch, mapPlace } from "@/lib/connectors";
import FoundList from "../FoundList";

// Google Maps: local businesses by type and place, through Google's Places API (no scraping).
export default async function GoogleMaps({ searchParams }) {
  const sp = await searchParams;
  const { company, role } = await getContext();
  const what = String(sp?.what || "").slice(0, 80).trim(), where = String(sp?.where || "").slice(0, 80).trim();
  const ready = !!process.env.GOOGLE_MAPS_API_KEY;
  const res = ready && what && where ? await placesSearch({ query: `${what} in ${where}`, pageToken: sp?.page || undefined }) : null;
  const rows = (res?.places || []).map((p) => mapPlace(p, { industry: what })).filter((r) => r.name);
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <div className="page-head"><div><h1>Google Maps</h1><p>Find local businesses for {company.legal_name} to approach — by what they do and where — with phone, address, website and rating. 2 credits for each one you add.</p></div></div>
      {!ready && <div className="notice small">Google Maps search is not switched on yet. Dhandha's admin adds a Google Maps Platform key (Places API) as <code>GOOGLE_MAPS_API_KEY</code> in Vercel.</div>}
      <form className="panel row" style={{ gap: 8, alignItems: "end" }} action="/app/leads/google-maps">
        <div style={{ flex: "2 1 220px" }}><label htmlFor="what">What kind of business</label><input id="what" name="what" defaultValue={what} placeholder="e.g. hospitals, builders, CA firms, schools" required /></div>
        <div style={{ flex: "1 1 160px" }}><label htmlFor="where">Where</label><input id="where" name="where" defaultValue={where} placeholder="e.g. Gurugram, Sector 44" required /></div>
        <button disabled={!ready}>Search</button>
      </form>
      {res?.error && <p className="error small">{res.error === "not_configured" ? "Google Maps is not switched on." : res.error}</p>}
      {res && !res.error && !rows.length && <p className="muted small">Nothing found. Try a broader place or another word for the business.</p>}
      {role !== "viewer" && <FoundList source="google_maps" rows={rows} note="2 credits each" />}
      {res?.next && <a className="btn ghost sm" href={`/app/leads/google-maps?${new URLSearchParams({ what, where, page: res.next })}`}>Next 20 results</a>}
    </div>
  );
}
