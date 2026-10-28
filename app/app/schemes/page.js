import Link from "next/link";
import { getContext } from "@/lib/session";
import { matchSchemes, FACTS } from "@/lib/schemes";
import SubmitButton from "@/components/SubmitButton";
import { answerScheme } from "./actions";

export const metadata = { title: "Government schemes" };
const ST = { likely: ["ok", "Likely for you"], check: ["warn", "Answer to check"], done: ["info", "Already done"], unlikely: ["mute", "Not for you now"] };

// Central schemes for small businesses, matched against the Vault. Free; links go to the official sites.
export default async function Schemes() {
  const { supabase, company } = await getContext();
  const [{ data: c }, { data: facts }] = await Promise.all([
    supabase.from("companies").select("udyam_no, msme_category, constitution, incorporation_date, state").eq("id", company.id).single(),
    supabase.from("company_facts").select("key, value").eq("company_id", company.id).eq("period", "").in("key", Object.keys(FACTS)),
  ]);
  const list = matchSchemes(c || {}, Object.fromEntries((facts || []).map((f) => [f.key, f.value])));
  const asked = new Set();
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Government schemes</h1>
        <p>Central schemes for small businesses that fit you — loans without collateral, tender benefits, subsidies, faster payments — worked out from your Business Vault. Free.</p></div>
        <Link href="/app/vault/profile" className="btn ghost">Update company profile</Link></div>
      <p className="tiny faint" style={{ margin: 0 }}>Amounts and rules change: always check the official site before applying. State governments have more schemes of their own.</p>
      <div className="grid-2" style={{ alignItems: "start" }}>
        {list.map((s) => {
          const showAsk = s.ask && !asked.has(s.ask.key) && (asked.add(s.ask.key) || true);
          return (
            <div key={s.id} className="panel stack-sm" style={{ opacity: s.status === "unlikely" ? 0.65 : 1 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{s.name}</strong>
                <span className={`chip ${ST[s.status][0]}`}>{ST[s.status][1]}</span>
              </div>
              <div className="tiny faint">{s.tag}</div>
              <p className="small" style={{ margin: 0 }}>{s.what}</p>
              <p className="small" style={{ margin: 0 }}><strong>For you:</strong> {s.why}</p>
              {showAsk && (
                <form action={answerScheme} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="key" value={s.ask.key} />
                  <span className="small">{s.ask.question}</span>
                  <SubmitButton name="value" value="yes" className="sm">Yes</SubmitButton>
                  <SubmitButton name="value" value="no" className="ghost sm">No</SubmitButton>
                </form>
              )}
              <a className="small" href={s.url} target="_blank" rel="noreferrer">Official site →</a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
