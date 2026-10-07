import Link from "next/link";

// Split layout for sign-in, onboarding and the 2FA check.
export default function AuthShell({ children, title, lines }) {
  return (
    <div className="auth-split">
      <aside className="auth-art">
        <Link href="/" className="wordmark" style={{ color: "#fff" }}><span>Dhandha</span><span className="dot" /></Link>
        <div>
          <h2>{title || "Every tender, lead and follow-up in one khata."}</h2>
          <p>{lines || "Your documents, letterhead and signature are entered once. Dhandha fills the rest — bid after bid."}</p>
          <TenderStack />
        </div>
        <p className="tiny" style={{ color: "rgba(255,255,255,.6)" }}>Data stored in India · 2FA protected · every signature use logged</p>
        <div className="deva" aria-hidden="true">धंधा</div>
      </aside>
      <main className="auth-form">
        <div className="auth-card stack">{children}</div>
      </main>
    </div>
  );
}

function TenderStack() {
  return (
    <svg viewBox="0 0 360 170" width="100%" style={{ maxWidth: 380, marginTop: 18 }} aria-hidden="true">
      <g opacity=".35"><rect x="40" y="18" width="200" height="132" rx="10" fill="#fff" transform="rotate(-6 140 84)" /></g>
      <g opacity=".6"><rect x="58" y="14" width="200" height="132" rx="10" fill="#fff" transform="rotate(-2 158 80)" /></g>
      <g>
        <rect x="80" y="12" width="200" height="140" rx="10" fill="#fff" />
        <rect x="98" y="30" width="110" height="9" rx="4" fill="#1b2240" />
        <rect x="98" y="50" width="160" height="6" rx="3" fill="#dde2ea" />
        <rect x="98" y="63" width="140" height="6" rx="3" fill="#dde2ea" />
        <rect x="98" y="76" width="150" height="6" rx="3" fill="#dde2ea" />
        <path d="M98 118c12-8 20 6 30-2s14-10 22 0" fill="none" stroke="#2f5fb3" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="98" y="128" width="64" height="2" fill="#dde2ea" />
      </g>
      <g transform="translate(250 104) rotate(-14)">
        <circle r="34" fill="none" stroke="#f0a202" strokeWidth="3" />
        <circle r="27" fill="none" stroke="#f0a202" strokeWidth="1.2" />
        <text y="-3" textAnchor="middle" fontSize="11" fontWeight="800" fill="#f0a202" style={{ letterSpacing: 1 }}>BID</text>
        <text y="11" textAnchor="middle" fontSize="11" fontWeight="800" fill="#f0a202" style={{ letterSpacing: 1 }}>READY</text>
      </g>
    </svg>
  );
}
