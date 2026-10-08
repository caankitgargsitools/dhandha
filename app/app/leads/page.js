import Link from "next/link";
import { getContext, fmtDate, calDays } from "@/lib/session";
import { ScoreRing, StageBars } from "@/components/Charts";
import Icon from "@/components/Icon";
import FormState from "../FormState";
import OwnerSelect from "@/components/OwnerSelect";
import { SOURCES, LEAD_STATUS, telLink, waLink, fillTemplate, DEFAULT_TEMPLATE } from "@/lib/leads";
import { addLead, importLeads, saveIdeal } from "./actions";

const TABS = [["all", "All"], ["mine", "Mine"], ["due", "Follow-ups due"], ["new", "Not contacted"], ["hot", "Hot (70+)"], ["closed", "Converted / closed"]];
const COLORS = ["var(--madder)", "var(--sky)", "var(--marigold)", "var(--leaf)", "var(--rust)", "var(--ink-2)", "var(--madder)", "var(--sky)"];

export default async function Leads({ searchParams }) {
  const params = await searchParams;
  const { supabase, tenant, company, user, role } = await getContext();
  const tab = TABS.some(([k]) => k === params?.tab) ? params.tab : "all";
  const q = String(params?.q || "").replace(/[^\p{L}\p{N}@.\s-]/gu, "").trim().slice(0, 60);
  const source = SOURCES[params?.source] ? params.source : "";

  let query = supabase.from("leads").select("*").eq("company_id", company.id);
  if (q) query = query.or(`name.ilike.%${q}%,contact_person.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%,industry.ilike.%${q}%`);
  if (source) query = query.eq("source", source);
  const [{ data: all }, { data: members }, { data: ideal }] = await Promise.all([
    query.order("score", { ascending: false }).order("created_at", { ascending: false }).limit(1000),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
    supabase.from("lead_preferences").select("*").eq("company_id", company.id).maybeSingle(),
  ]);
  const rows = all || [];
  const open = (l) => !["converted", "junk", "not_interested"].includes(l.status);
  const due = (l) => open(l) && l.next_follow_up_at && calDays(l.next_follow_up_at) <= 0;
  const lists = {
    all: rows.filter(open), mine: rows.filter((l) => l.owner_id === user.id && open(l)), due: rows.filter(due).sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at)),
    new: rows.filter((l) => l.status === "new"), hot: rows.filter((l) => open(l) && l.score >= 70), closed: rows.filter((l) => !open(l)),
  };
  const list = lists[tab].slice(0, 300);
  const name = (id) => { const m = (members || []).find((x) => x.user_id === id); return m ? (m.user_id === user.id ? "You" : m.profiles?.full_name || m.profiles?.email) : "—"; };
  const bySource = Object.entries(SOURCES).map(([k, label], i) => ({ label, value: rows.filter((l) => l.source === k).length, color: COLORS[i] })).filter((r) => r.value);
  const canWrite = role !== "viewer";
  const isLead = ["admin", "manager"].includes(role);
  const sellers = (members || []).filter((m) => ["admin", "manager", "telecaller", "field"].includes(m.role));
  const tpl = ideal?.wa_template || DEFAULT_TEMPLATE;
  const qs = (o) => new URLSearchParams(Object.entries({ tab, q, source, ...o }).filter(([, v]) => v)).toString();

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Leads</h1><p>Prospects for {company.legal_name}, scored on how well they fit your ideal client. {["telecaller", "field"].includes(role) ? "You see the leads given to you." : ""}</p></div>
      </div>
      {!ideal && isLead && <div className="notice"><Icon name="sparkle" /><span><strong>Tell Dhandha who your ideal client is</strong> (industries, cities, states) so leads are scored on fit. Use the panel on the right.</span></div>}

      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Follow-ups due</div><div className="kpi" style={{ color: lists.due.length ? "var(--blood)" : undefined }}>{lists.due.length}</div><div className="faint small">today or overdue</div></div>
        <div className="panel ledger"><div className="kpi-label">Hot leads (70+)</div><div className="kpi">{lists.hot.length}</div><div className="faint small">{lists.new.length} not contacted yet</div></div>
        <div className="panel">
          <div className="panel-head"><h3 style={{ fontSize: 15 }}>Where leads come from</h3><span className="faint small">{rows.length}</span></div>
          {bySource.length ? <StageBars rows={bySource} /> : <p className="small muted" style={{ margin: 0 }}>No leads yet.</p>}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 2.2fr) minmax(280px, 1fr)", alignItems: "start" }}>
        <div className="stack-sm">
          <div className="row" role="tablist">
            {TABS.map(([k, l]) => <Link key={k} role="tab" aria-selected={tab === k} href={`/app/leads?${qs({ tab: k })}`} className={`btn sm ${tab === k ? "" : "ghost"}`}>{l} <span className="faint">({lists[k].length})</span></Link>)}
          </div>
          <form className="row" action="/app/leads" style={{ gap: 8 }}>
            <input type="hidden" name="tab" value={tab} />
            <input name="q" defaultValue={q} placeholder="Search name, person, phone, city, industry" aria-label="Search leads" style={{ flex: "1 1 240px", width: "auto" }} />
            <select name="source" defaultValue={source} aria-label="Source" style={{ width: "auto" }}>
              <option value="">All sources</option>
              {Object.entries(SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="ghost sm">Filter</button>
          </form>
          <div className="panel flush table-wrap">
            <table>
              <thead><tr><th>Score</th><th>Business</th><th>Contact</th><th>Status</th><th>Owner</th><th>Follow-up</th></tr></thead>
              <tbody>
                {!list.length && <tr><td colSpan={6} className="muted" style={{ padding: 22 }}>{rows.length ? "Nothing in this view." : "No leads yet. Add one or import a CSV."}</td></tr>}
                {list.map((l) => {
                  const d = l.next_follow_up_at ? calDays(l.next_follow_up_at) : null;
                  const wa = !l.dnd && waLink(l.phone, fillTemplate(tpl, l, company));
                  const tel = !l.dnd && telLink(l.phone);
                  return (
                    <tr key={l.id}>
                      <td><ScoreRing score={l.score || 0} size={40} /></td>
                      <td><Link href={`/app/leads/${l.id}`}><strong>{l.name}</strong></Link><div className="tiny faint">{[l.industry, l.city].filter(Boolean).join(" · ")}</div><div className="tiny faint">{SOURCES[l.source]}</div></td>
                      <td className="small">{l.contact_person}
                        <div className="row tiny" style={{ gap: 10, marginTop: 2 }}>
                          {tel && <a href={tel} className="row" style={{ gap: 4 }}><Icon name="phone" size={12} />{l.phone}</a>}
                          {wa && <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
                          {l.email && <a href={`mailto:${l.email}`} className="row" style={{ gap: 4 }}><Icon name="mail" size={12} />Email</a>}
                          {l.dnd && <span className="chip bad">DND</span>}
                        </div>
                      </td>
                      <td><span className={`chip ${LEAD_STATUS[l.status][0]}`}>{LEAD_STATUS[l.status][1]}</span></td>
                      <td className="small">{name(l.owner_id)}</td>
                      <td className="small">{d === null ? <span className="faint">—</span> : <span className={`chip ${d < 0 ? "bad" : d === 0 ? "warn" : "mute"}`}>{d < 0 ? `${-d} d late` : d === 0 ? "Today" : fmtDate(l.next_follow_up_at).replace(/ \d{4}$/, "")}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lists[tab].length > list.length && <p className="small muted">Showing the top {list.length} of {lists[tab].length}. Search or filter to narrow down.</p>}
        </div>

        <div className="stack-sm">
          {canWrite && (
            <details className="panel" open={!rows.length}>
              <summary><strong>Add a lead</strong></summary>
              <FormState action={addLead} submit="Add lead">
                <div><label htmlFor="name">Business name</label><input id="name" name="name" required maxLength={200} /></div>
                <div className="form-grid">
                  <div><label htmlFor="contact_person">Contact person</label><input id="contact_person" name="contact_person" maxLength={120} /></div>
                  <div><label htmlFor="phone">Mobile</label><input id="phone" name="phone" inputMode="tel" maxLength={40} /></div>
                  <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" /></div>
                  <div><label htmlFor="industry">Industry</label><input id="industry" name="industry" maxLength={120} /></div>
                  <div><label htmlFor="city">City</label><input id="city" name="city" maxLength={80} /></div>
                  <div><label htmlFor="state">State</label><input id="state" name="state" maxLength={80} /></div>
                </div>
                <div className="form-grid">
                  <div><label htmlFor="source">Source</label><select id="source" name="source" defaultValue="referral">{Object.entries(SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                  {isLead && <OwnerSelect members={sellers} me={user.id} />}
                </div>
                <div><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={2} /></div>
              </FormState>
            </details>
          )}
          {canWrite && (
            <details className="panel">
              <summary><strong>Import from Excel / CSV</strong></summary>
              <p className="small muted">Save your sheet as CSV. We read columns like Name / Company, Contact Person, Mobile, Email, City, State, Industry. Duplicates (same mobile or email) are skipped.</p>
              <FormState action={importLeads} submit="Import">
                <input type="file" name="file" accept=".csv,text/csv" required aria-label="CSV file" />
                <div className="form-grid">
                  <div><label htmlFor="isource">These leads came from</label><select id="isource" name="source" defaultValue="upload">{Object.entries(SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                  {isLead && <OwnerSelect members={sellers} me={user.id} id="iowner" blank="Leave unassigned" />}
                </div>
              </FormState>
            </details>
          )}
          {isLead && (
            <details className="panel" open={!ideal}>
              <summary><strong>Ideal client</strong></summary>
              <p className="small muted">Leads in these industries and places score higher. Separate with commas.</p>
              <FormState action={saveIdeal} submit="Save and re-score">
                <div><label htmlFor="industries">Industries</label><textarea id="industries" name="industries" rows={2} defaultValue={(ideal?.industries || []).join(", ")} placeholder="Real estate, Logistics, Manufacturing" /></div>
                <div><label htmlFor="cities">Cities</label><input id="cities" name="cities" defaultValue={(ideal?.cities || []).join(", ")} placeholder="Gurugram, Delhi, Noida" /></div>
                <div><label htmlFor="states">States</label><input id="states" name="states" defaultValue={(ideal?.states || []).join(", ")} placeholder="Haryana, Delhi" /></div>
                <div><label htmlFor="wa_template">First WhatsApp message</label><textarea id="wa_template" name="wa_template" rows={3} defaultValue={tpl} />
                  <div className="tiny faint">Use {"{name}"}, {"{business}"}, {"{city}"}, {"{our_company}"}. It opens in your own WhatsApp; nothing is sent automatically.</div></div>
              </FormState>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
