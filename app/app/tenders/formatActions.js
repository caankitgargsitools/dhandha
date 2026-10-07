"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { classifyFormat } from "@/lib/formatLibrary";
import { aiFillFormats } from "@/lib/formatAi";
import { aiTiers } from "@/lib/ai";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);

export async function prepareFormats(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager", "bid_preparer"].includes(role)) return { error: "Only admins, managers and bid preparers can prepare formats." };
  const matchId = String(formData.get("match_id"));
  const useAi = formData.get("ai") === "1";
  const { data: m } = await supabase.from("tender_matches").select("id, tender_id, filled_formats, tenders(*)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m) return { error: "Tender not found." };
  const { data: reads } = await supabase.from("tender_reads").select("formats").eq("tender_id", m.tender_id).order("created_at", { ascending: false }).limit(5);
  // prefer the read that kept the format wording (the free reader does)
  const withText = (reads || []).find((r) => (r.formats || []).some((f) => f.text));
  const formats = (withText || reads?.[0])?.formats || [];
  if (!formats.length) return { error: "Read the tender first so Dhandha knows its formats." };

  const previous = Object.fromEntries((m.filled_formats || []).map((f) => [f.title, f]));
  let plan = formats.map((f) => {
    const kind = classifyFormat(f.title, f.text);
    const old = previous[f.title];
    return { title: f.title, page: f.page, kind, text: f.text || "", filled_text: old?.kind === "custom" ? old.filled_text : undefined, engine: kind === "custom" ? old?.engine : "library", missing: old?.missing || [] };
  });

  const custom = plan.filter((p) => p.kind === "custom");
  let message = `${plan.filter((p) => p.kind !== "custom").length} format(s) matched the free template library.`;
  if (custom.length && useAi) {
    if (!aiTiers().some((t) => !t.free)) return { error: "Filling custom formats needs a paid AI key (your company data never goes to free AI). Add ANTHROPIC_API_KEY." };
    const { data: w } = await supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle();
    if (Number(w?.balance || 0) < 49) return { error: "Not enough credits — filling custom formats needs 49." };
    const [{ data: c }, { data: facts }, { data: works }, { data: people }] = await Promise.all([
      supabase.from("companies").select("*").eq("id", company.id).single(),
      supabase.from("company_facts").select("key, period, value, unit").eq("company_id", company.id),
      supabase.from("experience_items").select("*").eq("company_id", company.id),
      supabase.from("people").select("*").eq("company_id", company.id),
    ]);
    const ai = await aiFillFormats({ supabase, tenantId: tenant.id, company: c, facts: facts || [], works: works || [], people: people || [], tender: m.tenders, formats: custom });
    if (ai.error) return { error: `${ai.error} (${ai.attempts.join("; ").slice(0, 200)})` };
    custom.forEach((p, i) => { p.filled_text = ai.data.formats[i].filled_text; p.missing = (ai.data.formats[i].missing || []).slice(0, 10); p.engine = ai.engine; });
    const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "format_fill", p_qty: 1, p_ref: m.tenders.tender_ref });
    if (se) return { error: se.message };
    message += ` ${custom.length} custom format(s) filled by ${ai.label}; 49 credits used.`;
  } else if (custom.length) {
    message += ` ${custom.length} custom format(s) need AI filling or manual text.`;
  }
  const gaps = plan.flatMap((p) => (p.missing || []).map((g) => ({ ...g, format: p.title, key: `form.${slug(g.label)}` })));
  await supabase.from("tender_matches").update({ filled_formats: plan, gaps }).eq("id", matchId);
  revalidatePath(`/app/tenders/${matchId}`);
  return { message };
}

// Gap window: every answer is saved to the Vault (Facts), so no tender asks it again.
export async function answerGaps(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot answer." };
  const matchId = String(formData.get("match_id"));
  const rows = [];
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("gap:")) continue;
    const value = String(v).trim();
    if (value) rows.push({ tenant_id: tenant.id, company_id: company.id, key: k.slice(4), period: "", value, source: "gap window" });
  }
  if (!rows.length) return { error: "Answer at least one question." };
  const { error } = await supabase.from("company_facts").upsert(rows, { onConflict: "company_id,key,period" });
  if (error) return { error: error.message };
  const { data: m } = await supabase.from("tender_matches").select("gaps").eq("id", matchId).single();
  const answered = new Set(rows.map((r) => r.key));
  await supabase.from("tender_matches").update({ gaps: (m?.gaps || []).filter((g) => !answered.has(g.key)) }).eq("id", matchId);
  revalidatePath(`/app/tenders/${matchId}`);
  return { message: `Saved ${rows.length} answer(s) to your Vault. Run “Fill with AI” again to put them into the formats; future tenders will use them automatically.` };
}
