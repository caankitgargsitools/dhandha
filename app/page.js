import Link from "next/link";
import Icon from "@/components/Icon";
import { ScoreRing } from "@/components/Charts";

const features = [
  ["vault", "Business Vault", "PAN, GST, audited accounts, work orders, letterhead and signature — entered once, reused in every bid."],
  ["tender", "Tender Engine", "GeM, CPPP and every state portal checked through the day. Each tender scored with reasons, read in full and filled for you."],
  ["leads", "Lead Engine", "New companies from MCA, local businesses, buyers from your IndiaMART account — filtered to the clients you want."],
  ["crm", "CRM & Outreach", "WhatsApp, email, SMS and AI calls in Hindi and English. Every lead has a next step and a date."],
  ["content", "Content Studio", "Your industry's news turned into LinkedIn posts and short videos, waiting for your approval."],
  ["wallet", "Pay as you use", "A small monthly fee per module and credits only for the work you run. GST invoice every time."],
];

export default function Home() {
  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px 80px" }}>
      <nav className="land-nav">
        <span className="wordmark"><span>Dhandha</span><span className="dot" /><small>धंधा</small></span>
        <div className="row">
          <Link href="/login" className="btn ghost">Sign in</Link>
          <Link href="/login?mode=signup" className="btn">Start free trial</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="deva-ghost" aria-hidden="true">धंधा</div>
        <div className="rise" style={{ position: "relative" }}>
          <h1>New business, found and filed.</h1>
          <p className="lede">Dhandha finds tenders and leads for your business, fills the bids on your letterhead, and keeps every follow-up on time.</p>
          <div className="row" style={{ marginTop: 26 }}>
            <Link href="/login?mode=signup" className="btn">Start 7-day trial</Link>
            <span className="small muted">500 free credits · no card needed</span>
          </div>
        </div>
        <HeroBoard />
      </section>

      <section>
        <h2 style={{ fontSize: 28, maxWidth: "24ch" }}>One suite, from the first lead to the signed bid.</h2>
        <div className="grid-2" style={{ gap: "0 48px" }}>
          {features.map(([icon, t, d]) => (
            <div key={t} className="feature">
              <div className="ic"><Icon name={icon} size={22} /></div>
              <div><h3 style={{ margin: "2px 0 4px" }}>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel ledger" style={{ marginTop: 56, padding: "28px 32px 28px 52px" }}>
        <div className="grid-2" style={{ alignItems: "center" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Built for Indian businesses, contractors and CA firms.</h2>
            <p className="muted">Reads tenders in English, Hindi and regional languages. Knows Udyam EMD exemptions, bid capacity formulas and DLT rules. Runs on servers in India.</p>
          </div>
          <div>
            {[["Full suite, per month", "₹2,499"], ["Tenders module", "₹999"], ["Bid pack, per tender", "299 credits"], ["Verified lead", "2 credits"]].map(([a, b]) => (
              <div key={a} className="price-row"><span>{a}</span><strong className="num">{b}</strong></div>
            ))}
          </div>
        </div>
      </section>
      <p className="faint small" style={{ marginTop: 40 }}>© 2026 Dhandha. Prices exclude GST.</p>
    </div>
  );
}

function HeroBoard() {
  const rows = [
    [92, "Storm water drains, Sectors 81–84", "HSVP · ₹8.64 Cr", "Closes in 14 days"],
    [88, "Widening of Pataudi–Rewari road", "PWD Haryana · ₹21.45 Cr", "Closes in 19 days"],
    [34, "4-lane ROB approach, Ghaziabad", "PWD UP · ₹48.7 Cr", "Not eligible"],
  ];
  return (
    <div className="panel rise d1" style={{ padding: 0, overflow: "hidden" }} aria-label="Example of matched tenders">
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line-soft)" }} className="row between">
        <strong style={{ fontFamily: "var(--display)" }}>Today's tender matches</strong>
        <span className="chip ok">3 new</span>
      </div>
      {rows.map(([s, t, a, d]) => (
        <div key={t} className="row" style={{ padding: "14px 20px", borderBottom: "1px solid var(--line-soft)", flexWrap: "nowrap" }}>
          <ScoreRing score={s} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{t}</div>
            <div className="small muted">{a}</div>
          </div>
          <span className={`chip ${s < 50 ? "mute" : "warn"}`}>{d}</span>
        </div>
      ))}
      <div style={{ padding: "14px 20px", background: "var(--marigold-soft)", flexWrap: "nowrap" }} className="row">
        <Icon name="sparkle" />
        <span className="small"><strong>Bid pack ready:</strong> 14 annexures filled on your letterhead, 2 questions for you.</span>
      </div>
    </div>
  );
}
