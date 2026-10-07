import "server-only";
import { runJson } from "./ai";

// Fills tender-specific formats (affidavits, undertakings, declarations in the authority's own words)
// from the company's Vault. Private data → paid engines only. One call for all formats of a tender.
export async function aiFillFormats({ supabase, tenantId, company, facts, works, people, tender, formats }) {
  const vault = {
    company: Object.fromEntries(Object.entries(company).filter(([k, v]) => v && !["id", "tenant_id", "created_at", "updated_at", "bank_account"].includes(k))),
    facts: facts.map((f) => ({ key: f.key, period: f.period || undefined, value: f.value, unit: f.unit || undefined })),
    completed_works: works.filter((w) => w.status === "completed").slice(0, 10).map((w) => ({ name: w.work_name, client: w.client, value_inr: w.value_inr, end: w.end_date })),
    key_people: people.slice(0, 10).map((p) => ({ name: p.name, designation: p.designation, qualification: p.qualification, years: p.years_experience })),
    tender: { title: tender.title, ref: tender.tender_ref, authority: tender.authority, department: tender.department, value_inr: tender.value_inr, emd_inr: tender.emd_inr },
    today: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  };
  const prompt = `You fill Indian tender formats for the bidder below.
For EACH format, copy its wording exactly and fill every blank, dotted line, bracket or placeholder using ONLY the bidder data. Keep numbering and order. Do not add clauses.
If a value is not in the data, write [TO BE FILLED: <what is needed>] in its place and list it in "missing".
Do not include signature lines; the system adds the signature block.
Bidder data (JSON):
${JSON.stringify(vault)}

Formats:
${formats.map((f, i) => `### FORMAT ${i + 1}: ${f.title}\n${String(f.text).slice(0, 3500)}`).join("\n\n")}

Return JSON: {"formats": [{"title": string, "filled_text": string, "missing": [{"label": short question to ask the bidder, "hint": example answer}]}]} in the same order.`;
  return runJson({
    supabase, tenantId, task: "format_fill", prompt, private: true, maxTokens: 8000,
    validate: (d) => (!Array.isArray(d.formats) || d.formats.length !== formats.length ? "wrong number of formats" : d.formats.some((f) => !f.filled_text) ? "empty format" : null),
  });
}
