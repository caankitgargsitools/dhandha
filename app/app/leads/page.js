import { getContext, fmtDate } from "@/lib/session";
import { ScoreRing, StageBars } from "@/components/Charts";
import Icon from "@/components/Icon";
import PreviewNote from "@/components/PreviewNote";

const SOURCES = { google_maps: "Google Maps", mca: "MCA new company", indiamart: "IndiaMART", website: "Website", directory: "Directory", tender_winner: "Tender winner", upload: "Your upload", referral: "Referral" };

export default async function Leads() {
  const { supabase, company } = await getContext();
  const { data: leads } = await supabase.from("leads").select("*").eq("company_id", company.id).order("score", { ascending: false });
  const bySource = Object.entries(SOURCES).map(([k, label]) => ({ label, value: (leads || []).filter((l) => l.source === k).length })).filter((r) => r.value);
  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Leads</h1><p>Prospects found for {company.legal_name}, ranked by how well they fit your ideal client.</p></div>
      </div>
      <PreviewNote>Lead campaigns with filters (industry, city, company size and age) arrive in Phase 3.</PreviewNote>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h3>Where leads come from</h3><span className="faint small">{leads?.length || 0} leads</span></div>
          <StageBars rows={bySource.map((r, i) => ({ ...r, color: ["var(--madder)", "var(--sky)", "var(--marigold)", "var(--leaf)", "var(--rust)", "var(--ink-2)", "var(--madder)", "var(--sky)"][i] }))} />
        </div>
        <div className="panel ledger">
          <div className="kpi-label">Hot leads (score 70+)</div>
          <div className="kpi">{(leads || []).filter((l) => l.score >= 70).length}</div>
          <p className="faint small" style={{ margin: 0 }}>Scored on fit, freshness (new company, recent tender win) and how easy they are to reach.</p>
        </div>
      </div>
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Score</th><th>Business</th><th>Contact</th><th>Location</th><th>Source</th><th>Added</th></tr></thead>
          <tbody>
            {(leads || []).map((l) => (
              <tr key={l.id}>
                <td><ScoreRing score={l.score || 0} size={40} /></td>
                <td><strong>{l.name}</strong><div className="tiny faint">{l.industry}</div></td>
                <td className="small">{l.contact_person}<div className="row tiny faint" style={{ gap: 10 }}>{l.phone && <span className="row" style={{ gap: 4 }}><Icon name="phone" size={12} />{l.phone}</span>}{l.email && <span className="row" style={{ gap: 4 }}><Icon name="mail" size={12} />{l.email}</span>}</div></td>
                <td className="small"><span className="row" style={{ gap: 4 }}><Icon name="map" size={13} />{l.city}, {l.state}</span></td>
                <td><span className="chip mute plain">{SOURCES[l.source]}</span></td>
                <td className="small faint">{fmtDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
