const modules = [
  ["Business Vault", "Documents from Google Drive, letterhead, signature, brand kit"],
  ["Tender Engine", "GeM, CPPP, state portals — discover, score, fill, assemble"],
  ["Lead Engine", "Google Maps, MCA, IndiaMART and more, with custom filters"],
  ["CRM & Outreach", "WhatsApp, email, SMS and AI calls with rigorous follow-up"],
  ["Content Studio", "One-touch posts and AI videos from industry news"],
  ["Billing", "Small monthly plan + pay-as-you-go credits"],
];

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "64px 16px" }}>
      <p style={{ color: "#f59e0b", fontWeight: 600, letterSpacing: 1 }}>COMING SOON</p>
      <h1 style={{ fontSize: 48, margin: "8px 0" }}>Dhandha</h1>
      <p style={{ fontSize: 20, color: "#cbd5e1" }}>The one-stop business generation suite.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 40 }}>
        {modules.map(([t, d]) => (
          <div key={t} style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 8px" }}>{t}</h3>
            <p style={{ margin: 0, color: "#94a3b8" }}>{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
