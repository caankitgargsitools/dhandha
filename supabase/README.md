# Database

Migrations are applied to Supabase project `umyesrpibsdgzsrqfvqf` (Mumbai). Phase 0 migrations:

1. `phase0_core_schema` — profiles, tenants, members, companies, facts, document catalogue, documents, experience, people, brand assets, signature log, modules, price book, subscriptions, wallets, credit ledger, invoices, audit log
2. `phase0_rls_triggers_rpcs` — Row Level Security per tenant, audit triggers, `create_workspace`, `add_company`, `spend_credits`, `log_signature_use`, private `brand` storage bucket
3. `phase0_seed_catalogue_and_prices` — modules, draft rate card, document catalogue
4. `phase0_tighten_function_grants`, `fix_audit_row_company_id`

Phase 3 (leads and CRM):

5. `phase3_leads_crm_columns` — lead owner/status/follow-up/notes, normalised `phone_norm`/`email_norm` for de-duplication, deal owner/notes/closed and escalation stamps, `lead_preferences` (ideal client + WhatsApp opener), append-only `crm_activities`, `sees_all_leads` (telecaller and field see only their own leads and deals)
6. `phase3_leads_crm_logic` — guards on leads/deals (owner must be a member, only managers reassign), activity → lead status, stage moves logged to the timeline and a won deal converts its lead, `import_leads` (manual add and CSV, skips duplicate phone/email), `escalate_overdue_deals`
7. `phase3_leads_crm_policies` — role-aware read/write on leads and deals
8. `phase3_escalation_cron`, `phase3_escalation_demo_seed` — pg_cron runs `escalate_overdue_deals` hourly at :17; tasks raised from demo deals are registered in `demo_seed`
9. `phase3_tender_winner_leads` — shared `tender_awards` (award-of-contract results from our crawler), `norm_firm` (firm-name matching that ignores M/s, Pvt Ltd, LLP…), `ingest_awards` (crawler intake; marks a company's own tender match won when it is the winner), `winner_prospects` (one row per winning firm matching the ideal client and winner settings, minus existing leads), `import_leads` now takes contactless tender winners, de-duplicates them by firm name and charges `lead_found` credits per lead added

Billing:

10. `billing_razorpay` — `billing_settings` (seller GSTIN/state/address, SAC, invoice prefix, suite price, minimum top-up), `billing_orders`, `billing_events`, invoice snapshot columns, `billing_create_order` (prices in SQL, admin only), `billing_attach_order`, `billing_fulfil` (credits, 30-day plan period, GST invoice numbered per financial year), `razorpay_webhook` (verifies the HMAC with the Vault secret `razorpay_webhook_secret`, checks the amount, idempotent per event and payment)
11. `billing_webhook_ready` — admin panel check that the Vault secret exists

New companies (MCA):

12. `phase3_mca_new_companies`, `phase3_mca_add_leads_fix` — shared `mca_companies` (CIN/LLPIN, registration date, state, class, capital, activity, registered office, email), readable only by platform admins; `upsert_mca`, `admin_ingest_mca` (admin upload), `ingest_mca` (ingest-key feeds), `mca_prospects` (per company: registered in the last N days, ideal-client places and industries, minimum paid-up capital, minus existing leads), `add_mca_leads`; `leads.cin`; `import_leads` charges `lead_found` for MCA leads too

Outreach:

13. `phase3_outreach_tables` — `whatsapp_send` price, lead flags (`email_opt_out`, `wa_opt_in`, `unsub_token`), `outreach_settings` (sender name, reply-to, WhatsApp number id; the token is a Vault secret), `sequences`, `sequence_steps`, `enrollments`, `outreach_messages`; `save_outreach_settings`, `set_whatsapp_token`, `enroll_leads`, `queue_message`, `outreach_unsubscribe`, `outreach_render`
14. `phase3_outreach_worker` — pg_net; Vault secret `outreach_worker_key` (generated in SQL, never shown); `outreach_claim` (due steps → messages, credits charged up front), `outreach_report` (sent → timeline, failed → refund), `outreach_kick` / `outreach_kick_if_due` (pg_cron every 5 minutes → POST /api/outreach/run), `admin_set_app_url`; a logged conversation stops the lead's sequences

Google Drive:

15. `google_drive_connections` — `drive_connections` (Google email, AES-GCM-encrypted refresh token, root folder; readable by writers), `company_drive_folders` (one folder per company, tied to the root), `save_drive_connection`, `disconnect_drive` (clears the token, keeps the row)

Social lead sources:

16. `lead_sources_social` — lead sources `linkedin`, `facebook`, `instagram`; `leads.linkedin_url`
17. `social_leads_linkedin_meta` — `import_leads` takes LinkedIn connections without phone/email (matched on profile URL, free); `meta_pages` (Facebook Pages per workspace, token in Vault), `meta_lead_jobs`, `save_meta_pages`, `disconnect_meta_page`, `meta_webhook` (verifies X-Hub-Signature-256 with Vault `meta_app_secret`, queues lead ids), `meta_claim` / `meta_report` (worker, same Vault key as outreach), `worker_kick(path)`; the 5-minute cron also wakes the Meta worker

18. `crawler_live_progress` — `crawler_live` (what each runner is doing now), `crawler_step_stats` (moving-average seconds per portal step), `crawler_progress` (ingest-key RPC the crawler calls)
19. `crawler_captcha_help` — `crawler_captchas` (captcha pictures waiting for a person; platform-admin read), `captcha_ask` / `captcha_poll` (ingest-key RPCs the crawler calls), `answer_captcha` / `skip_captcha` (platform admin types or skips)
20. `tender_conditions_questions` — `tenders.conditions`, `tender_matches.pending`, `set_tender_conditions`; `score_tender` checks yes/no conditions against `company_facts`, treats missing turnover / no recorded works / unanswered conditions as pending instead of not eligible, and defaults the similar-work window to 7 years when the tender gives none
21. `tender_doc_fetch` — `tender_doc_jobs`, `tender_doc_chunks`; `request_tender_docs`, `answer_doc_captcha`, `mark_doc_job` (users); `doc_job_claim`, `doc_job_update`, `doc_job_poll`, `doc_job_put_chunk` (crawler, ingest key; `private.check_ingest_key`)
22. `tender_docs_bucket_types` — `tender-docs` bucket also takes Excel, Word, zip and images
23. `tender_price_and_costing` — `tender_matches.cost_sheet`, `quoted_price`, `price_note`, `priced_at`
24. `phone_app_push` — `push_subscriptions`, `push_queue`; `push_public_key`, `push_init_keys` (private key to Vault), `push_test`, `push_claim` / `push_report` (worker key), `private.push_to`; triggers on `crawler_captchas` and `tender_doc_jobs`; cron `push_tender_digest` (hourly), `push_followups` (daily), `push_kick_if_due` (5 min); `worker_kick` allows `/api/push/run`
25. `lead_sources_maps_apollo` — lead source `apollo`; `import_leads` charges `lead_found` for `google_maps` and accepts contactless `apollo` rows; `lead_connectors` + `set_apollo_key` / `disconnect_apollo` / `apollo_key` (Apollo key in Vault)
26. `data_marketplace` — `data_sets`, `data_records`, `data_suppression`, `data_purchases`; price_book `data_record`; lead source `database`; `data_set_save`, `data_ingest`, `data_suppress` (platform admin), `data_search` (masked), `data_buy`, `data_buy_matching` (`private.data_buy_ids` charges credits, makes leads)
27. `data_marketplace_bucket` — private `datasets` bucket (platform admin only)
28. `data_marketplace_grants` / `data_marketplace_fix_buy` — data RPCs not callable by anon; buy fix
