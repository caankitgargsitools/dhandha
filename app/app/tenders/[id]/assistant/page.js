import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, lakh, fmtDate, daysLeft } from "@/lib/session";
import { aiTiers } from "@/lib/ai";
import { checkConditions } from "@/lib/conditions";
import { requiredDocs } from "@/lib/bidpack";
import Assistant from "./Assistant";
import TenderBrief from "../../TenderBrief";

export const maxDuration = 60;

const PROFILE_NEEDED = [["legal_name", "legal name"], ["pan", "PAN"], ["gstin", "GSTIN"], ["registered_address", "registered address"], ["signatory_name", "signatory's name"], ["signatory_designation", "signatory's designation"], ["bank_account", "bank account"], ["bank_ifsc", "IFSC"]];

// The last three completed financial years, newest first: "FY 2025-26", ...
function lastFys(now = new Date()) {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [1, 2, 3].map((k) => `FY ${start - k}-${String(start - k + 1).slice(2)}`);
}

// Tender assistant: a chat that walks one tender from documents to a draft bid pack, asking each thing it
// needs on the way. Every answer goes into the Vault, so the next tender asks less.
export default async function TenderAssistant({ params }) {
  const { id } = await params;
  const { supabase, company, role } = await getContext();
  const { data: m } = await supabase.from("tender_matches").select("*, tenders(*)").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!m) notFound();
  const t = m.tenders;
  const [{ data: c }, { data: files }, { data: reads }, { data: facts }, { count: works }, { data: packs }, { data: jobs }, { data: docs }, { data: types }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("tender_files").select("id, file_name").eq("tender_id", t.id),
    supabase.from("tender_reads").select("engine, fields, formats, risks, summary, created_at").eq("tender_id", t.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("company_facts").select("key, period, value").eq("company_id", company.id),
    supabase.from("experience_items").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "completed"),
    supabase.from("bid_packs").select("id, kind, created_at").eq("match_id", m.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("tender_doc_jobs").select("id, status, step, detail, error, created_at").eq("tender_id", t.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("documents").select("type_code, valid_until").eq("company_id", company.id).eq("status", "active"),
    supabase.from("document_types").select("code, name"),
  ]);
  const job = jobs?.[0] || null;
  const msme = ["micro", "small"].includes(c.msme_category) && c.udyam_no;
  const checklist = requiredDocs(t.industry_pack, msme, t.req_docs).map((code) => {
    const d = (docs || []).filter((x) => x.type_code === code).sort((a, b) => new Date(b.valid_until || "2999-01-01") - new Date(a.valid_until || "2999-01-01"))[0];
    return { code, name: (types || []).find((x) => x.code === code)?.name || code, state: !d ? "missing" : d.valid_until && new Date(d.valid_until) < new Date(t.due_at) ? "expiring" : "ok" };
  });
  const confirmed = ["preparing", "submitted", "won", "lost"].includes(m.status);
  const read = reads?.[0];
  const answers = Object.fromEntries((facts || []).filter((f) => !f.period).map((f) => [f.key, f.value]));
  const turnoverYears = new Set((facts || []).filter((f) => f.key === "fin.turnover").map((f) => f.period));
  const cond = checkConditions(t.conditions, answers);
  const asks = (m.reasons || []).filter((r) => r.ask);
  const canPrepare = ["admin", "manager", "bid_preparer"].includes(role);
  const custom = (m.filled_formats || []).filter((f) => f.kind === "custom" && !f.filled_text);
  const paidAi = aiTiers().some((x) => !x.free);

  // What has been done (shown as the assistant's earlier messages) and what is next (asked one at a time).
  const done = [];
  const steps = [];
  // 1. documents: fetched from the portal by the crawler (captcha typed here), or uploaded
  const pdfs = (files || []).filter((x) => /\.pdf$/i.test(x.file_name));
  if (pdfs.length) done.push(`I have ${files.length} tender document${files.length === 1 ? "" : "s"}: ${files.map((x) => x.file_name).join(", ").slice(0, 200)}.`);
  else steps.push({ id: "fetch", kind: "fetch", job: job && ["queued", "running", "captcha", "fetched", "failed"].includes(job.status) ? job : null, portal: t.portal, aiReady: aiTiers().length > 0,
    say: files?.length ? `I have ${files.map((x) => x.file_name).join(", ")} but not the tender's PDF yet, so I'll fetch again from ${t.portal}.` : `First I'll fetch the tender documents from ${t.portal}. If the portal shows a captcha, I'll put the picture here for you to type.` });

  // 2. read them, then 3. the brief — nothing is prepared until you say it looks good
  if (pdfs.length && !read) steps.push({ id: "read", kind: "read", auto: true, say: "Reading the documents now…", aiReady: aiTiers().length > 0 });
  if (read && !confirmed) {
    steps.push({ id: "brief", kind: "brief", say: "Here is the tender in one page. Shall we go ahead and prepare the bid?" });
  }
  if (!confirmed) {
    const left = daysLeft(t.due_at);
    return page({ m, t, left, done, steps, role, canPrepare, brief: read ? <TenderBrief t={t} m={m} read={read} detail={job?.detail} checklist={checklist} files={files} /> : null });
  }
  if (read) done.push("You approved the brief — preparing the bid.");

  for (const x of cond.met) done.push(`✓ ${x.label} — you told me yes earlier (saved in your Vault).`);
  for (const x of cond.failed) done.push(`✗ ${x.label} — your Vault says no, so this tender is not eligible. Change it in Vault → Facts if that has changed.`);
  for (const x of cond.pending) steps.push({ id: `q:${x.key}`, kind: "yes_no", key: x.key, label: x.label, say: x.question, quote: x.quote, page: x.page });

  if (asks.some((a) => a.key === "fin.turnover")) {
    const years = lastFys().filter((fy) => !turnoverYears.has(fy));
    steps.push({ id: "turnover", kind: "turnover", years, say: `${asks.find((a) => a.key === "fin.turnover").text.split(". ")[0]}. What was your turnover in these years (in rupees)?` });
  }
  if (asks.some((a) => a.key === "vault.experience") || (!works && read)) {
    steps.push({ id: "experience", kind: "link", href: "/app/vault/experience", button: "Add completed works", say: `${asks.find((a) => a.key === "vault.experience")?.text.split(". ")[0] || "This tender asks for similar work"}. I have no completed works on record yet. Add them once (name, client, value, completion date) and every tender will use them.` });
  }
  const missingProfile = PROFILE_NEEDED.filter(([k]) => !c[k]).map(([, l]) => l);
  if (missingProfile.length) steps.push({ id: "profile", kind: "link", href: "/app/vault/profile", button: "Fill company profile", say: `The bid forms need your ${missingProfile.join(", ")}. Fill them once in your company profile.` });

  if (read?.formats?.length && !(m.filled_formats || []).length) steps.push({ id: "formats", kind: "formats", say: `The tender has ${read.formats.length} format${read.formats.length === 1 ? "" : "s"} to fill. Shall I match them to my free templates?` });
  else if ((m.filled_formats || []).length) done.push(`I matched ${m.filled_formats.length} format${m.filled_formats.length === 1 ? "" : "s"}.`);
  for (const g of m.gaps || []) steps.push({ id: `g:${g.key}`, kind: "gap", key: g.key, say: `For “${g.format}”: ${g.label}?`, hint: g.hint || "" });
  if (custom.length && canPrepare) steps.push({ id: "fill_ai", kind: "fill_ai", paidAi, say: `${custom.length} format${custom.length === 1 ? " is" : "s are"} in the tender's own wording. Shall I fill ${custom.length === 1 ? "it" : "them"} from your Vault with AI (49 credits)? Your company data only goes to paid AI.` });

  if (packs?.[0]) done.push(`A ${packs[0].kind === "final" ? "signed" : "draft"} bid pack was made ${fmtDate(packs[0].created_at)}.`);
  if (read && canPrepare) steps.push({ id: "draft", kind: "draft", last: true, say: `${packs?.[0] ? "Shall I make a fresh bid file with your latest answers?" : m.eligible && !m.pending ? "That is everything I need — this tender is qualified." : "Some answers are still open, but I can make the file with what we have."} The bid file is one PDF: the tender brief, the submission checklist (documents, fees, dates), the covering letter and every format filled from your Vault. Free, marked DRAFT; signed only with the admin's code.` });

  const left = daysLeft(t.due_at);
  return page({ m, t, left, done, steps, role, canPrepare, brief: read ? <TenderBrief t={t} m={m} read={read} detail={job?.detail} checklist={checklist} files={files} /> : null });
}

function page({ m, t, left, done, steps, role, canPrepare, brief }) {
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <Link href={`/app/tenders/${m.id}`} className="small">Back to the tender</Link>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Tender assistant</h1>
          <p style={{ margin: 0 }}>{t.title}</p>
          <div className="row tiny faint" style={{ gap: 10, marginTop: 6 }}>
            <span>{t.authority}</span><span>{t.tender_ref}</span><span>{left >= 0 ? `closes in ${left} d` : "closed"}</span>
          </div>
        </div>
        <span className={`chip ${!m.eligible ? "bad" : m.pending ? "warn" : "ok"}`}>{!m.eligible ? "Not eligible" : m.pending ? `Qualifies if you answer ${m.pending}` : "Qualified"}</span>
      </div>
      <Assistant matchId={m.id} tenderId={t.id} done={done} steps={steps} brief={brief} canAnswer={role !== "viewer"} canPrepare={canPrepare} />
    </div>
  );
}
