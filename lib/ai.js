import "server-only";

// Cost policy: free → cheapest → cheaper → costlier. Each tier is tried in order and the first answer that passes
// validation wins. Free tiers may use inputs to train their models, so they only ever see PUBLIC material (tender
// documents). Anything with a customer's private data skips them (private: true).
// USD per million tokens; Haiku 5.5's lower price holds for prompts up to 100K tokens.
const USD_PER_MTOK = {
  "claude-haiku-5": { in: 0.1, out: 0.5, over100k: { in: 0.5, out: 2.5 } },
  "claude-haiku": { in: 1, out: 5 },
  "claude-sonnet": { in: 2, out: 10 },
};

export function aiTiers() {
  const env = process.env;
  const tiers = [];
  if (env.GEMINI_API_KEY) {
    tiers.push({ id: "gemini-free", label: "Gemini Flash (free tier)", provider: "gemini", model: env.GEMINI_MODEL || "gemini-flash-latest", free: true });
    // a second free try on the lighter model: Flash is often "busy" (503) on the free tier
    tiers.push({ id: "gemini-lite", label: "Gemini Flash-Lite (free tier)", provider: "gemini", model: env.GEMINI_LITE_MODEL || "gemini-flash-lite-latest", free: true, wait: 20000 });
  }
  if (env.ANTHROPIC_API_KEY) {
    // extraction work needs little reasoning: low effort keeps thinking (and cost) down
    tiers.push({ id: "claude-haiku-5", label: "Claude Haiku 5.5 (lowest cost)", provider: "anthropic", model: env.ANTHROPIC_CHEAP_MODEL || "claude-haiku-5-5", effort: "low" });
    tiers.push({ id: "claude-haiku", label: "Claude Haiku 4.5 (low cost)", provider: "anthropic", model: "claude-haiku-4-5" });
    tiers.push({ id: "claude-sonnet", label: "Claude Sonnet (for hard cases)", provider: "anthropic", model: env.ANTHROPIC_STRONG_MODEL || "claude-sonnet-5-5", effort: "medium" });
  }
  return tiers;
}

function parseJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  return JSON.parse(start >= 0 ? t.slice(start, end + 1) : t);
}

async function callGemini(tier, { prompt, pdf, text, maxTokens, timeoutMs = 50000 }) {
  const parts = [];
  if (pdf) parts.push({ inline_data: { mime_type: "application/pdf", data: Buffer.from(pdf).toString("base64") } });
  if (text) parts.push({ text });
  parts.push({ text: prompt });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${tier.model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: 0 } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return { text: j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "", inTok: j.usageMetadata?.promptTokenCount || 0, outTok: j.usageMetadata?.candidatesTokenCount || 0 };
}

async function callAnthropic(tier, { prompt, pdf, text, maxTokens, timeoutMs = 120000 }) {
  const content = [];
  if (pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(pdf).toString("base64") } });
  if (text) content.push({ type: "text", text });
  content.push({ type: "text", text: prompt + "\nReply with the JSON object only." });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    // newer models think before answering; the thinking counts against max_tokens, so leave room for it
    body: JSON.stringify({ model: tier.model, max_tokens: tier.effort ? maxTokens + 8000 : maxTokens, ...(tier.effort ? { output_config: { effort: tier.effort } } : {}), messages: [{ role: "user", content }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  if (j.stop_reason === "refusal") throw new Error(`declined (${j.stop_details?.category || "policy"})`);
  if (j.stop_reason === "max_tokens") throw new Error("answer cut off (max_tokens)");
  return { text: j.content?.filter((c) => c.type === "text").map((c) => c.text).join("") || "", inTok: j.usage?.input_tokens || 0, outTok: j.usage?.output_tokens || 0 };
}

/**
 * Run a JSON-returning AI task on the cheapest engine that succeeds.
 * opts: { supabase, tenantId, task, prompt, pdf?, text?, private, validate?(obj)=>string|null, maxTokens, startAt?, budgetMs? }
 */
export async function runJson(opts) {
  const { supabase, tenantId, task, validate, maxTokens = 4000 } = opts;
  let tiers = aiTiers();
  if (opts.private) tiers = tiers.filter((t) => !t.free);
  if (opts.startAt) tiers = tiers.slice(Math.max(0, tiers.findIndex((t) => t.id === opts.startAt)));
  if (!tiers.length) return { error: "No AI engine is configured yet.", attempts: [] };
  const attempts = [];
  // a time budget for the whole chain (the page's function limit): the free tier gets a short wait when paid tiers
  // stand behind it, and a tier only starts if there is time left for it to finish
  const until = Date.now() + (opts.budgetMs || 240000);
  for (const [i, tier] of tiers.entries()) {
    let res, ok = false, note = "";
    const left = until - Date.now();
    if (left < 15000) { attempts.push(`${tier.id}: skipped (no time left)`); continue; }
    const more = i < tiers.length - 1;
    const timeoutMs = Math.min(left - 2000, tier.wait || (tier.free && more ? 30000 : more ? 90000 : 150000));
    try {
      res = tier.provider === "gemini" ? await callGemini(tier, { ...opts, maxTokens, timeoutMs }) : await callAnthropic(tier, { ...opts, maxTokens, timeoutMs });
      const data = parseJson(res.text);
      const problem = validate ? validate(data) : null;
      if (problem) { note = `rejected: ${problem}`; throw new Error(note); }
      ok = true;
      await log(supabase, { tenantId, task, tier, res, ok, note });
      return { data, engine: tier.id, label: tier.label, model: tier.model, attempts: [...attempts, tier.id] };
    } catch (e) {
      note = note || e.message.slice(0, 300);
      attempts.push(`${tier.id}: ${note}`);
      await log(supabase, { tenantId, task, tier, res, ok: false, note });
    }
  }
  return { error: "Every AI engine failed.", attempts };
}

async function log(supabase, { tenantId, task, tier, res, ok, note }) {
  let p = USD_PER_MTOK[tier.id];
  if (p?.over100k && res?.inTok > 100000) p = p.over100k;
  const cost = p && res ? (res.inTok * p.in + res.outTok * p.out) / 1e6 : 0;
  try {
    await supabase.from("ai_usage").insert({ tenant_id: tenantId || null, task, provider: tier.provider, model: tier.model,
      input_tokens: res?.inTok || 0, output_tokens: res?.outTok || 0, cost_usd: cost, ok, note: note || null });
  } catch { /* logging must never break the task */ }
}
