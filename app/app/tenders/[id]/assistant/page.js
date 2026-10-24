import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, lakh, fmtDate, daysLeft } from "@/lib/session";
import { aiTiers } from "@/lib/ai";
import { checkConditions, mandatoryUnmet } from "@/lib/conditions";
import { requiredDocs } from "@/lib/bidpack";
import { missingMasters, fillPlaceholders, isReference } from "@/lib/masters";
import { buildSegments, blanksLeft } from "@/lib/annexure";
import { computeSheet } from "@/lib/costing";
import { candidates, CHOICES } from "@/lib/formatLibrary";
import { emptySheet, monthsFrom } from "@/lib/costing";
import Assistant from "./Assistant";
import TenderBrief from "../../TenderBrief";

// AI steps (reading, filling, marking) can take a few minutes; lib/ai.js keeps the whole chain inside this
export const maxDuration = 300;

// When the tender's own list of formats is not known: the usual set.
const STANDARD = [
  { title: "Bidder information", kind: "bidder_info" }, { title: "Financial turnover and net worth", kind: "turnover" },
  { title: "Statement of similar works completed", kind: "similar_works" }, { title: "Key personnel", kind: "key_personnel" },
  { title: "Declaration regarding blacklisting / debarment", kind: "non_blacklisting" }, { title: "Declaration for MSE benefits", kind: "mse" },
];

// Tender assistant: a chat that walks one tender from documents to a draft bid pack, asking each thing it
// needs on the way. Every answer goes into the Vault, so the next tender asks less.
export default async function TenderAssistant({ params }) {
  const { id } = await params;
  const { supabase, company, role, isPlatformAdmin } = await getContext();
  const { data: m } = await supabase.from("tender_matches").select("*, tenders(*)").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!m) notFound();
  const t = m.tenders;
  const [{ data: c }, { data: files }, { data: reads }, { data: facts }, { data: workRows }, { data: peopleRows }, { data: packs }, { data: jobs }, { data: docs }, { data: types }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("tender_files").select("id, file_name, storage_path").eq("tender_id", t.id).order("file_name"),
    supabase.from("tender_reads").select("engine, fields, formats, risks, summary, created_at").eq("tender_id", t.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("company_facts").select("key, period, value").eq("company_id", company.id),
    supabase.from("experience_items").select("*").eq("company_id", company.id),
    supabase.from("people").select("*").eq("company_id", company.id).order("created_at"),
    supabase.from("bid_packs").select("id, kind, created_at").eq("match_id", m.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("tender_doc_jobs").select("id, status, step, detail, error, created_at").eq("tender_id", t.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("documents").select("type_code, valid_until").eq("company_id", company.id).eq("status", "active"),
    supabase.from("document_types").select("code, name"),
  ]);
  // download links for the fetched documents (one signing call for all of them)
  const paths = (files || []).map((x) => x.storage_path).filter(Boolean);
  const { data: signed } = paths.length ? await supabase.storage.from("tender-docs").createSignedUrls(paths, 3600) : { data: [] };
  for (const x of files || []) x.url = (signed || []).find((s) => s.path === x.storage_path)?.signedUrl || null;
  const job = jobs?.[0] || null;
  const works = (workRows || []).filter((w) => w.status === "completed").length, people = (peopleRows || []).length;
  const msme = ["micro", "small"].includes(c.msme_category) && c.udyam_no;
  const checklist = requiredDocs(t.industry_pack, msme, t.req_docs).map((code) => {
    const d = (docs || []).filter((x) => x.type_code === code).sort((a, b) => new Date(b.valid_until || "2999-01-01") - new Date(a.valid_until || "2999-01-01"))[0];
    return { code, name: (types || []).find((x) => x.code === code)?.name || code, state: !d ? "missing" : d.valid_until && new Date(d.valid_until) < new Date(t.due_at) ? "expiring" : "ok" };
  });
  const confirmed = ["preparing", "submitted", "won", "lost"].includes(m.status);
  const read = reads?.[0];
  const answers = Object.fromEntries((facts || []).filter((f) => !f.period).map((f) => [f.key, f.value]));
  const cond = checkConditions(t.conditions, answers);
  const canPrepare = ["admin", "manager", "bid_preparer"].includes(role);
  const paidAi = aiTiers().some((x) => !x.free);

  // What has been done (shown as the assistant's earlier messages) and what is next (asked one at a time).
  const done = [];
  const steps = [];
  // 1. documents: fetched from the portal by the crawler (captcha typed here), or uploaded
  const pdfs = (files || []).filter((x) => /\.pdf$/i.test(x.file_name));
  if (pdfs.length) done.push(`I have ${files.length} tender document${files.length === 1 ? "" : "s"}: ${files.map((x) => x.file_name).join(", ").slice(0, 200)}.`);
  else steps.push({ id: "fetch", kind: "fetch", job: job && ["queued", "running", "captcha", "fetched", "failed"].includes(job.status) ? job : null, portal: t.portal, aiReady: aiTiers().length > 0, typer: isPlatformAdmin,
    say: files?.length ? `I have ${files.map((x) => x.file_name).join(", ")} but not the tender's PDF yet, so I'll fetch again from ${t.portal}.` : `First I'll fetch the tender documents from ${t.portal}. This usually takes a few minutes — you can leave this page; I'll notify you when they're in.` });

  // 2. read them, then 3. the brief — nothing is prepared until you say it looks good
  if (pdfs.length && !read) steps.push({ id: "read", kind: "read", auto: true, say: "Reading the documents now…", aiReady: aiTiers().length > 0 });
  if (read && !confirmed) {
    steps.push({ id: "brief", kind: "brief", say: "Here is the tender in one page. Shall we go ahead and prepare the bid?" });
  }
  if (!confirmed) {
    const left = daysLeft(t.due_at);
    return page({ m, t, left, done, steps, role, canPrepare, files, redo: canPrepare && read ? { read: aiTiers().length > 0 } : null, brief: read ? <TenderBrief t={t} m={m} read={read} detail={job?.detail} checklist={checklist} files={files} /> : null });
  }
  if (read) done.push("You approved the brief — preparing the bid.");

  for (const x of cond.met) done.push(`✓ ${x.label} — you told me yes earlier (saved in your Vault).`);
  for (const x of cond.pending) steps.push({ id: `q:${x.key}`, kind: "yes_no", key: x.key, label: x.label, say: x.question, quote: x.quote, page: x.page });

  // a mandatory condition that is not met never silently rejects the tender: the person is warned and decides —
  // "we do meet it" (the Vault is corrected), file anyway (recorded), or not for us. Nothing goes further until then.
  const unmet = [...new Set([...cond.failed.map((x) => x.label), ...mandatoryUnmet(m.reasons)])];
  if (unmet.length && !m.forced_at) {
    steps.push({ id: "mandatory", kind: "mandatory", unmet, conds: cond.failed.map((x) => ({ key: x.key, label: x.label })),
      say: `Warning: ${unmet.length === 1 ? "a mandatory condition of this tender is" : `${unmet.length} mandatory conditions of this tender are`} not met according to your Vault. A bid that misses a mandatory condition is usually rejected at the technical stage.` });
    const left = daysLeft(t.due_at);
    return page({ m, t, left, done, steps, role, canPrepare, files, brief: read ? <TenderBrief t={t} m={m} read={read} detail={job?.detail} checklist={checklist} files={files} /> : null });
  }
  if (unmet.length) done.push(`⚠ Filing although: ${unmet.join("; ")} — you chose to file anyway on ${fmtDate(m.forced_at)}${m.forced_note ? ` (“${m.forced_note}”)` : ""}.`);

  // 4. formats: the best template for each, alternatives offered; confirmed with one click
  const plan = m.filled_formats || [];
  let formatsView = null;
  if (!plan.length) {
    const fmts = read?.formats?.length ? read.formats : STANDARD;
    steps.push({ id: "choose", kind: "choose_formats", say: `The tender asks for ${fmts.length} format${fmts.length === 1 ? "" : "s"}. For each one I've picked the best fit from my templates — change any you like, then confirm.`,
      formats: fmts.map((f) => ({ title: f.title, page: f.page || null, options: (f.kind ? [f.kind, "custom", "manual"] : candidates(f.title, f.text)).map((k) => ({ kind: k, label: CHOICES[k] })) })) });
  } else {
    const n = (k) => plan.filter((p) => p.kind === k).length;
    done.push(`Formats chosen: ${plan.length - n("custom") - n("manual") - n("price")} from my templates${n("custom") ? `, ${n("custom")} in the tender's own wording` : ""}${n("manual") ? `, ${n("manual")} you'll fill yourself` : ""}${n("price") ? ", the price bid on the portal" : ""}.`);
    // 5. master questions: only what the chosen formats need and the masters don't have, one at a time
    for (const q of missingMasters(c, ["covering_letter", ...plan.map((p) => p.kind)], { facts: facts || [], counts: { works, people } })) steps.push(q);
    // 6. formats kept in the tender's own wording: filled from the masters by AI; blanks it could not fill become master questions
    const todo = plan.filter((p) => p.kind === "custom" && !p.filled_text);
    if (todo.length && canPrepare) steps.push({ id: "fill_ai", kind: "fill_ai", paidAi, say: `${todo.length} format${todo.length === 1 ? " is" : "s are"} in the tender's own wording. Shall I fill ${todo.length === 1 ? "it" : "them"} from your masters with AI (49 credits)? Your company data only goes to paid AI.` });
    // each annexure in the tender's own wording opens as a form, pre-filled from the masters; the person fills the
    // yellow boxes, adds rows, changes wording, and saves (answers and new rows go to the masters)
    const ctx = { facts: facts || [], people: peopleRows || [], works: workRows || [] };
    plan.forEach((p, idx) => {
      if (p.reviewed || !canPrepare) return;
      const text = p.kind === "custom" ? p.filled_text : p.kind === "manual" ? p.text : null;
      if (!text || isReference(text)) return;
      const segments = buildSegments(text, ctx);
      const left = blanksLeft(segments);
      steps.push({ id: `ax:${idx}`, kind: "annexure", idx, title: p.title, segments,
        say: `Here is “${p.title}”, filled from your masters.${left ? ` ${left} yellow box${left === 1 ? "" : "es"} need${left === 1 ? "s" : ""} you` : " Check it"} — add rows or change wording if you like, then save.` });
    });
    // the formats as they will go into the bid file, to look at (and open again) any time
    formatsView = plan.map((p, idx) => {
      if (p.kind === "price") return { title: p.title, status: "Price — quoted on the portal" };
      if (p.kind !== "custom" && p.kind !== "manual") return { title: p.title, status: "Ready — from my template" };
      const src = p.edited_text || (p.kind === "custom" ? p.filled_text : p.text);
      if (!src) return { title: p.title, status: p.kind === "custom" ? "Waiting for AI fill" : "You fill it in the draft" };
      if (isReference(src)) return { title: p.title, status: "Reference page — nothing to fill" };
      const text = p.edited_text || fillPlaceholders(src, facts || [], { people: peopleRows || [], works: workRows || [] });
      const left = (text.match(/\[TO BE FILLED:/gi) || []).length;
      return { idx, editable: canPrepare, title: p.title, status: left ? `${left} blank${left === 1 ? "" : "s"} left` : p.reviewed ? "Ready — checked by you" : "Ready", text: text.replace(/⟦\/?table[^⟧]*⟧/g, "").slice(0, 6000) };
    });
  }

  // technical marking: how the tender is evaluated and the marks your Vault earns (paid AI, asked once)
  if (m.tech_eval) {
    const ev = m.tech_eval, tot = ev.criteria?.length ? ev.criteria.reduce((a, c) => [a[0] + (c.awarded || 0), a[1] + (c.max || 0)], [0, 0]) : null;
    done.push(`Evaluation: ${ev.method === "QCBS" ? `QCBS, technical ${ev.tech_weight}% : financial ${ev.fin_weight}%` : ev.method === "L1" ? "L1 — lowest price among qualified bids wins" : ev.method}${tot ? `. Your technical marks: ${tot[0]} of ${tot[1]}` : ""}.`);
  } else if (read && canPrepare && plan.length) {
    steps.push({ id: "tech", kind: "tech_eval", paidAi, say: "Shall I work out how this tender is evaluated and your technical marks, criterion by criterion, from your Vault? For an L1 tender I'll give you the best price; for QCBS, your weighted final score. (29 credits)" });
  }

  // 7. the price — the one thing asked for every tender: typed, or worked out in the cost planner
  if (m.quoted_price) done.push(`Your price: ₹${Number(m.quoted_price).toLocaleString("en-IN")} + GST${m.price_note ? ` (${m.price_note})` : ""}.`);
  else if (canPrepare && read) {
    const f = read.fields || {};
    steps.push({ id: "price", kind: "price", fresh: !m.cost_sheet, ev: m.tech_eval || null, cost: m.cost_sheet ? computeSheet(m.cost_sheet).cost : null, quote: m.quoted_price || null, estimate: Number(f.value_inr || t.value_inr || job?.detail?.value_inr) || null,
      sheet: m.cost_sheet || emptySheet({ months: monthsFrom(f.completion_period || job?.detail?.period_of_work), value: Number(f.value_inr || t.value_inr || job?.detail?.value_inr) || null, scope: f.work_scope || [], travel: !!(t.state && c.state && t.state !== c.state) }),
      say: "Last, your price. Type it if you know it, or let's work out the cost together — items, manpower with PF/ESI/bonus, travel and stay, overheads and margin — and I'll suggest a quote." });
  }

  if (packs?.[0]) done.push(`A ${packs[0].kind === "final" ? "signed" : "draft"} bid pack was made ${fmtDate(packs[0].created_at)}.`);
  if (read && canPrepare) steps.push({ id: "draft", kind: "draft", last: true, say: `${packs?.[0] ? "Shall I make a fresh bid file with your latest answers?" : m.eligible && !m.pending ? "That is everything I need — this tender is qualified." : "Some answers are still open, but I can make the file with what we have."} The bid file is one PDF: the tender brief, the submission checklist (documents, fees, dates), the covering letter and every format filled from your Vault. Free, marked DRAFT; signed only with the admin's code.` });

  const left = daysLeft(t.due_at);
  // results can be redone (e.g. after a bad read of a big scanned document)
  const redo = canPrepare && read ? { read: aiTiers().length > 0, tech: !!m.tech_eval && paidAi } : null;
  return page({ m, t, left, done, steps, role, canPrepare, files, formatsView, redo, brief: read ? <TenderBrief t={t} m={m} read={read} detail={job?.detail} checklist={checklist} files={files} /> : null });
}

function page({ m, t, left, done, steps, role, canPrepare, files, brief, formatsView = null, redo = null }) {
  return (
    <div className="stack" style={{ maxWidth: 1040 }}>
      <Link href={`/app/tenders/${m.id}`} className="small">Back to the tender</Link>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Tender assistant</h1>
          <p style={{ margin: 0 }}>{t.title}</p>
          <div className="row tiny faint" style={{ gap: 10, marginTop: 6 }}>
            <span>{t.authority}</span><span>{t.tender_ref}</span><span>{left === null ? "closing date not known yet" : left >= 0 ? `closes in ${left} d` : "closed"}</span>
          </div>
        </div>
        <span className={`chip ${mandatoryUnmet(m.reasons).length || m.pending ? "warn" : "ok"}`}>{mandatoryUnmet(m.reasons).length ? (m.forced_at ? "Filing despite a warning" : "⚠ Mandatory condition not met") : m.pending ? `Qualifies if you answer ${m.pending}` : "Qualified"}</span>
      </div>
      {!!files?.length && (
        <details className="panel" style={{ padding: "10px 14px" }}>
          <summary className="small" style={{ cursor: "pointer" }}><strong>Tender documents ({files.length})</strong> <span className="muted">— download what was fetched from {t.portal}</span></summary>
          <ul className="small" style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
            {files.map((x) => <li key={x.id} style={{ overflowWrap: "anywhere" }}>{x.url ? <a href={x.url} download={x.file_name} target="_blank" rel="noreferrer">{x.file_name}</a> : x.file_name}</li>)}
          </ul>
        </details>
      )}
      <Assistant matchId={m.id} tenderId={t.id} done={done} steps={steps} brief={brief} formats={formatsView} redo={redo} canAnswer={role !== "viewer"} canPrepare={canPrepare} />
    </div>
  );
}
