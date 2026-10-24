import "server-only";
import { buildCatalog } from "./taxonomy.js";

// The industry / service catalogue for a workspace: built-in + approved additions + its own pending ones.
export async function loadCatalog(supabase, tenantId) {
  const { data } = await supabase.from("taxonomy_custom").select("id, tenant_id, kind, parent, label, keywords, status").limit(2000);
  return buildCatalog((data || []).map((r) => ({ ...r, mine: r.tenant_id === tenantId })));
}
