-- 64. Fast re-score (29 Oct 2026, applied with apply_migration rescore_fast_and_queued). A full re-score scans every
-- live tender (≈60k) and took 15–20 s; app calls are cut off at 8 s, so assistant answers and "Save and re-score"
-- silently did nothing. Now rescore_company re-scores the open matches at once (≈3 s) and queues the full scan;
-- cron rescore_queue (every minute) runs private.rescore_core for queued companies.
create table if not exists private.rescore_requests (company_id uuid primary key, requested_at timestamptz not null default now(), done_at timestamptz);
-- private.rescore_open_matches(company): tender_fits + upsert_match on open, fitting matches (≤150), else unfit
-- public.rescore_company(company): member check; queue; private.rescore_open_matches
-- private.rescore_queue_run(): ≤5 queued companies a minute → private.rescore_core
-- select cron.schedule('rescore_queue', '* * * * *', 'select private.rescore_queue_run()');

-- 64b. action_lock / action_unlock (apply_migration action_locks, 29 Oct): one AI reading / AI format fill at a time
-- per company and tender, so a second click or a retried request no longer pays twice. private.action_locks(key, until).

-- 64c. Conditions met by Vault documents (apply_migration conditions_met_by_vault_documents, 29 Oct):
-- private.cond_vault_doc(company, label, due) maps a condition's wording to document types (peer review → CERT-PEER,
-- GST (not "in the state of …") → REG-GST, Udyam / MSME / NSIC, ISO 9001, EPF, ESI, labour licence, PAN, ICAI firm
-- registration / constitution certificate → CERT-ICAI) and returns the valid document's name; score_tender counts an
-- unanswered condition as met with "(in your Vault: …)" instead of asking.
