"use server";
import { getContext } from "@/lib/session";

const clean = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// Add your own industry, sub-industry or service. It works for your workspace straight away; the platform admin
// reviews it, and once approved everyone can find it.
export async function addCustomTaxonomy({ kind, parent, label, keywords }) {
  const { supabase, tenant, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot add to the list." };
  if (!["industry", "sub", "service"].includes(kind)) return { error: "Pick what you are adding." };
  const name = clean(label, 120);
  if (name.length < 2) return { error: "Give it a name." };
  if (kind !== "industry" && !parent) return { error: kind === "sub" ? "Pick the industry it belongs to." : "Pick the sub-industry it belongs to." };
  const words = (Array.isArray(keywords) ? keywords : String(keywords || "").split(",")).map((w) => clean(w, 120)).filter(Boolean).slice(0, 30);
  if (kind === "service" && !words.length) words.push(name.toLowerCase());
  const { data, error } = await supabase.from("taxonomy_custom")
    .insert({ tenant_id: tenant.id, kind, parent: kind === "industry" ? null : String(parent).slice(0, 80), label: name, keywords: kind === "service" ? words : [] })
    .select("id, kind, parent, label, keywords, status").single();
  if (error) return { error: error.message };
  return { ok: true, row: { ...data, mine: true } };
}
