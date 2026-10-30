-- 66. Vault documents are read on upload (30 Oct 2026; applied with apply_migration vault_document_reading).
-- Files go to the private bucket vault-docs (<tenant>/<company>/<time>-<name>, ≤25 MB); lib/vaultRead.js reads them
-- (free reader first — lib/docRead.js — then paid AI for statements, MoA / AoA, deeds, work orders and scans) and
-- fills the masters without overwriting; the result is kept in documents.extracted.
insert into storage.buckets (id, name, public, file_size_limit) values ('vault-docs', 'vault-docs', false, 26214400) on conflict (id) do nothing;
create policy "vault-docs read members" on storage.objects for select using (bucket_id = 'vault-docs' and public.is_tenant_member(((storage.foldername(name))[1])::uuid));
create policy "vault-docs write members" on storage.objects for insert with check (bucket_id = 'vault-docs' and coalesce(public.tenant_role(((storage.foldername(name))[1])::uuid), '') in ('admin','manager','bid_preparer','telecaller','field'));
alter table public.documents add column if not exists storage_path text, add column if not exists file_name text, add column if not exists mime text,
  add column if not exists read_status text not null default 'none', add column if not exists read_at timestamptz;
alter table public.documents add constraint documents_read_status_check check (read_status in ('none','reading','done','partial','failed','nothing'));
alter table public.people add column if not exists din text, add column if not exists share_pct numeric, add column if not exists source text;
insert into public.price_book (action_code, module_code, name, credits, unit, note)
values ('vault_read', 'platform', 'Read a document with AI (balance sheet, MoA, deed, scanned copy)', 5, 'document', 'Certificates with typed text are read free')
on conflict (action_code) do nothing;
