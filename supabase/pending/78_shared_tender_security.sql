-- Security follow-ups from the 1 Nov review, applied 2 Nov with execute_sql.
-- 1. A workspace's reading only fills gaps in a tender's shared figures (value, EMD, turnover, similar works, MSE
--    exemption, documents, prerequisites) — it no longer overwrites what every other matched firm is scored on. Each
--    workspace keeps its own reading in tender_reads. (apply_tender_read, edited in place: coalesce(existing, new);
--    7 similar-work years is the column default, so a reading's own figure replaces only that.)
-- 2. set_tender_conditions merges: conditions already on the tender stay as they are; a reading only adds new keys (≤30).
-- 3. Files in the tender-docs bucket are readable only by members of a workspace matched to that tender, or platform
--    admins (path = <tender_id>/<file>):
alter policy "tender docs read" on storage.objects
  using (bucket_id = 'tender-docs' and (
    exists (select 1 from public.tender_matches m where m.tender_id::text = (storage.foldername(objects.name))[1] and public.is_tenant_member(m.tenant_id))
    or public.is_platform_admin()));
-- (1 and 2 were applied as in-place replacements of the function text with pg_get_functiondef + execute; see the
-- session notes in PENDING.md. Re-running: the functions already carry the comments "filled, never overwritten" and
-- "never removes or rewrites others'".)
