import Link from "next/link";
import { getContext, lakh, fmtDate } from "@/lib/session";
import { summarise, discountPct } from "@/lib/pastResults";
import { STATES } from "@/lib/conditions";
import { PACKS } from "@/lib/leads";

export const metadata = { title: "Past results" };

export default async function PastResults({ searchParams }) {
  const sp = await searchParams;
  const q = (sp.q || "").slice(0, 120), state = sp.state || "", pack = sp.pack || "", bidder = (sp.bidder || "").slice(0, 80);
  const days = Number(sp.days) || 730;
  const { supabase } = await getContext();
  const { data: rows, error } = await supabase.rpc("past_results", { p_q: q || null, p_state: state || null, p_pack: pack || null, p_bidder: bidder || null, p_days: days, p_limit: 200 });
  const list = rows || [];
  const sum = summarise(list);

  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head">
        <div>
          <h1>Past results</h1>
          <p>Who won which government contract and for how much — award results read by Dhandha&apos;s own crawler from public portals. Search before you price a bid.</p>
        </div>
      </div>

      <form className="panel row" style={{ gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 220px" }}><label htmlFor="q">Work or department</label><input id="q" name="q" defaultValue={q} placeholder="e.g. concurrent audit, road, CCTV" /></div>
        <div style={{ flex: "1 1 160px" }}><label htmlFor="state">State</label>
          <select id="state" name="state" defaultValue={state}><option value="">All India</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div style={{ flex: "1 1 160px" }}><label htmlFor="pack">Kind of work</label>
          <select id="pack" name="pack" defaultValue={pack}><option value="">All kinds</option>{Object.entries(PACKS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div style={{ flex: "1 1 160px" }}><label htmlFor="bidder">Winner (firm)</label><input id="bidder" name="bidder" defaultValue={bidder} placeholder="Firm name" /></div>
        <div style={{ flex: "0 1 130px" }}><label htmlFor="days">Awarded in</label>
          <select id="days" name="days" defaultValue={String(days)}>{[[90, "3 months"], [180, "6 months"], [365, "1 year"], [730, "2 years"], [1825, "5 years"]].map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select></div>
        <button className="btn">Search</button>
      </form>

      {error && <p className="error">{error.message}</p>}

      {sum.count > 0 && (
        <div className="grid-3">
          <div className="panel"><div className="tiny faint">Contracts found</div><div style={{ fontSize: 26, fontWeight: 700 }}>{sum.count}</div></div>
          <div className="panel"><div className="tiny faint">Contract size</div><div style={{ fontSize: 20, fontWeight: 700 }}>{sum.min === sum.max ? lakh(sum.min) : `${lakh(sum.min)} – ${lakh(sum.max)}`}</div><div className="tiny faint">middle {lakh(sum.median)}</div></div>
          <div className="panel"><div className="tiny faint">Against the estimate</div><div style={{ fontSize: 20, fontWeight: 700 }}>{sum.discount ? (sum.discount.median >= 0 ? `${sum.discount.median}% below` : `${-sum.discount.median}% above`) : "—"}</div><div className="tiny faint">{sum.discount ? `from ${sum.discount.known} with a known estimate` : "estimates not published for these"}</div></div>
        </div>
      )}

      {sum.winners.some((w) => w.wins > 1) && (
        <div className="panel small"><strong>Repeat winners: </strong>{sum.winners.filter((w) => w.wins > 1).map((w) => `${w.name} (${w.wins} wins, ${lakh(w.total)})`).join(" · ")}</div>
      )}

      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Work</th><th>Winner</th><th>Awarded</th><th>vs estimate</th><th>Date</th></tr></thead>
          <tbody>
            {list.map((a) => {
              const d = discountPct(a.awarded_value, a.estimate);
              return (
                <tr key={a.award_id}>
                  <td className="small">{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a> : a.title}<div className="tiny faint">{[a.authority, a.district, a.state].filter(Boolean).join(" · ")} · {a.portal}</div></td>
                  <td className="small"><Link href={`/app/tenders/results?bidder=${encodeURIComponent(a.bidder_name || "")}`}>{a.bidder_name || "—"}</Link>{a.bidder_city && <div className="tiny faint">{a.bidder_city}</div>}</td>
                  <td className="num small">{a.awarded_value ? lakh(a.awarded_value) : "—"}</td>
                  <td className="num small">{d === null ? "—" : d >= 0 ? `${d}% below` : `${-d}% above`}</td>
                  <td className="small">{fmtDate(a.contract_date)}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={5} className="muted small">No award results match. Results arrive as the crawler reads each portal&apos;s &ldquo;Results of tenders&rdquo; pages — try fewer words or a longer period.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>Free to search. Awarded value is what the portal published; &ldquo;vs estimate&rdquo; shows only when the tender&apos;s estimate was published too.</p>
    </div>
  );
}
