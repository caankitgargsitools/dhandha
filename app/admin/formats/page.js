import { getAdminContext } from "@/lib/admin";
import { SECTORS, sectorLabel } from "@/lib/formatHarvest";
import { EXEC_NOTE } from "@/lib/formatTemplates";
import { reviewFormat, harvestSettings } from "./actions";

// The learned format catalogue: every annexure Dhandha has read in a tender, cleaned and counted. New kinds of format
// arrive by themselves (customer readings, pre-checks, the twice-daily harvest); approve the good ones (offered first),
// hide junk, or tidy the wording. Customers see every entry that is not hidden.
export default async function FormatCatalogue({ searchParams }) {
  const sp = await searchParams;
  const status = ["new", "approved", "hidden"].includes(sp?.s) ? sp.s : "new";
  const sector = SECTORS[sp?.sec] ? sp.sec : "";
  const q = String(sp?.q || "").trim().slice(0, 60);
  const { supabase } = await getAdminContext();
  let query = supabase.from("format_catalog").select("id, heading, type, sectors, exec, body, seen_count, used_count, authorities, headings, quality, first_seen, status").eq("status", status);
  if (sector) query = query.contains("sectors", [sector]);
  if (q) query = query.ilike("heading", `%${q.replace(/[%_]/g, "")}%`);
  const [{ data: rows }, { data: stats }] = await Promise.all([query.order("seen_count", { ascending: false }).limit(100), supabase.rpc("format_harvest_admin")]);
  const link = (o) => `?${new URLSearchParams({ s: status, ...(sector ? { sec: sector } : {}), ...(q ? { q } : {}), ...o })}`;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Format catalogue</h1><p>Annexures learned from tenders Dhandha has read — {stats?.entries ?? 0} formats, {stats?.new_week ?? 0} new this week. Repeats are counted, new kinds are added by themselves. Approved ones are offered first; hidden ones never.</p></div></div>
      <form action={harvestSettings} className="panel row" style={{ gap: 10, alignItems: "end" }}>
        <div><label htmlFor="pr">Tenders fetched per harvest run (10:37 and 15:37; 0 = off)</label><input id="pr" name="per_run" type="number" min="0" max="40" defaultValue={stats?.per_run ?? 8} style={{ width: 90 }} /></div>
        <button className="ghost">Save</button>
        <button name="run" value="1">Run a harvest now</button>
        <span className="small muted">Harvest: {stats?.open ?? 0} fetching · {stats?.done ?? 0} done · {stats?.failed ?? 0} not fetched · {stats?.reads_waiting ?? 0} readings waiting to be learned. Each fetch may need a captcha typed in the captcha session.</span>
      </form>
      <div className="row" style={{ gap: 6 }}>
        {["new", "approved", "hidden"].map((s) => <a key={s} href={`?${new URLSearchParams({ s, ...(sector ? { sec: sector } : {}) })}`} className={`btn sm ${s === status ? "" : "ghost"}`}>{s[0].toUpperCase() + s.slice(1)}</a>)}
        <span className="faint">·</span>
        <a href={link({ sec: "" })} className={`btn sm ${!sector ? "" : "ghost"}`}>All industries</a>
        {Object.entries(SECTORS).map(([k, v]) => <a key={k} href={link({ sec: k })} className={`btn sm ${sector === k ? "" : "ghost"}`}>{v.label}</a>)}
        <form className="row" style={{ gap: 6 }}><input type="hidden" name="s" value={status} />{sector && <input type="hidden" name="sec" value={sector} />}<input name="q" defaultValue={q} placeholder="Search headings" style={{ width: 200 }} /><button className="ghost sm">Search</button></form>
      </div>
      {!rows?.length && <div className="panel small muted">Nothing here yet.</div>}
      {(rows || []).map((r) => (
        <form key={r.id} action={reviewFormat} className="panel stack-sm">
          <input type="hidden" name="id" value={r.id} />
          <div className="row between">
            <span><strong>{r.heading}</strong> <span className="chip mute plain">{r.type}</span>{(r.sectors || []).map((s) => <span key={s} className="chip info plain" style={{ marginLeft: 4 }}>{sectorLabel(s)}</span>)}{r.exec && <span className="chip warn plain" style={{ marginLeft: 4 }}>{EXEC_NOTE[r.exec]}</span>}</span>
            <span className="tiny faint">seen in {r.seen_count} tender{r.seen_count === 1 ? "" : "s"} · used {r.used_count} · quality {r.quality} · since {new Date(r.first_seen).toLocaleDateString("en-IN")}</span>
          </div>
          {(r.authorities || []).length > 0 && <div className="tiny faint">From: {(r.authorities || []).slice(0, 6).join(" · ")}{r.authorities.length > 6 ? ` +${r.authorities.length - 6}` : ""}{(r.headings || []).length > 1 ? ` · also called: ${r.headings.filter((h) => h !== r.heading).slice(0, 4).join(" · ")}` : ""}</div>}
          <details><summary className="small" style={{ cursor: "pointer" }}>Wording and edit</summary>
            <div className="stack-sm" style={{ marginTop: 6 }}>
              <div><label>Heading</label><input name="heading" defaultValue={r.heading} /></div>
              <div><label>Wording ({"{legal_name}"}, {"{tender_ref}"}, {"{authority}"}… are filled from the Vault; [TO BE FILLED: …] become boxes)</label><textarea name="body" rows={12} defaultValue={r.body} style={{ fontFamily: "inherit" }} /></div>
            </div>
          </details>
          <div className="row" style={{ gap: 8 }}>
            {status !== "approved" && <button name="status" value="approved">Approve</button>}
            {status !== "hidden" && <button name="status" value="hidden" className="ghost">Hide</button>}
            {status === "hidden" && <button name="status" value="new" className="ghost">Bring back</button>}
            <button name="status" value="" className="ghost">Save edits</button>
          </div>
        </form>
      ))}
    </div>
  );
}
