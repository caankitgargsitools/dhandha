import Link from "next/link";

const modules = [
  ["Business Vault", "Your documents in Google Drive, letterhead, signature and every company fact — entered once."],
  ["Tender Engine", "GeM, CPPP and every state portal: found, scored, read, filled and assembled for you."],
  ["Lead Engine", "New companies, local businesses and buyers, filtered to your ideal client."],
  ["CRM & Outreach", "WhatsApp, email, SMS and AI calls, with follow-ups that never slip."],
  ["Content Studio", "Posts and videos from your industry's news, ready with one click."],
  ["Pay as you go", "A small monthly fee per module and credits only for what you use."],
];

export default function Home() {
  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 16px 80px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="logo">Dhan<span>dha</span></div>
        <div className="row">
          <Link href="/login" className="btn ghost">Sign in</Link>
          <Link href="/login?mode=signup" className="btn">Start 7-day trial</Link>
        </div>
      </div>
      <h1 style={{ fontSize: 42, lineHeight: 1.15, margin: "64px 0 12px", maxWidth: 720 }}>
        Find new business, win it, and never fill the same form twice.
      </h1>
      <p className="muted" style={{ fontSize: 18, maxWidth: 640 }}>
        Dhandha is the one-stop business generation suite for Indian businesses, contractors and CA firms.
      </p>
      <div className="grid" style={{ marginTop: 40 }}>
        {modules.map(([t, d]) => (
          <div key={t} className="panel">
            <h3>{t}</h3>
            <p className="muted small" style={{ margin: 0 }}>{d}</p>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 40 }}>7-day trial with 500 free credits. No card needed.</p>
    </main>
  );
}
