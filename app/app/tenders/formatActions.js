"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { classifyFormat } from "@/lib/formatLibrary";
import { aiFillFormats } from "@/lib/formatAi";
import { aiTiers } from "@/lib/ai";
import { labelKey } from "@/lib/masters";

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
  // a format seen before keeps the kind chosen for it, the text typed into it and its review mark
  let plan = formats.map((f) => {
    const old = previous[f.title];
    const kind = old?.kind || classifyFormat(f.title, f.text);
    return { title: f.title, page: f.page, kind, text: f.text || "", filled_text: old?.kind === "custom" ? old.filled_text : undefined, engine: kind === "custom" ? old?.engine : "library", missing: old?.missing || [],
      ...(old?.edited_text ? { edited_text: old.edited_text } : {}), ...(old?.reviewed ? { reviewed: old.reviewed } : {}) };
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
  const gaps = plan.flatMap((p) => (p.missing || []).map((g) => ({ ...g, format: p.title, key: labelKey(g.label) })));
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
    if (value) rows.push({ gap: k.slice(4), value });
  }
  if (!rows.length) return { error: "Answer at least one question." };
  const { data: m } = await supabase.from("tender_matches").select("gaps").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m) return { error: "Tender not found." };
  // saved under the master.* key the bid file fills its blanks from (gaps saved earlier were keyed form.*)
  const labels = Object.fromEntries((m.gaps || []).map((g) => [g.key, g.label]));
  const facts = [...new Map(rows.map((r) => {
    const key = labelKey(labels[r.gap] || r.gap.replace(/^(form|master)\./, ""));
    return [key, { tenant_id: tenant.id, company_id: company.id, key, period: "", value: r.value.slice(0, 2000), source: "gap window" }];
  })).values()].filter((r) => r.key.length > 7);
  if (!facts.length) return { error: "Answer at least one question." };
  const { error } = await supabase.from("company_facts").upsert(facts, { onConflict: "company_id,key,period" });
  if (error) return { error: error.message };
  const answered = new Set(rows.map((r) => r.gap));
  await supabase.from("tender_matches").update({ gaps: (m.gaps || []).filter((g) => !answered.has(g.key)) }).eq("id", matchId).eq("company_id", company.id);
  revalidatePath(`/app/tenders/${matchId}`);
  revalidatePath(`/app/tenders/${matchId}/assistant`);
  return { message: `Saved ${facts.length} answer(s) to your Vault. They go into the formats' blanks in the bid file automatically — no need to fill with AI again. Future tenders will use them too.` };
}
