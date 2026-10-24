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
29. `precise_tender_matching` (+ `_pack_not`, `_fast_rescore`, `_fast_rescore_fix`) — `tender_preferences.rules` / `muted`, `tender_matches.matched_on` / `unfit`, `tender_pack_not`; `tender_match_words`, `tender_fits` on rules, `upsert_match` stores the words, `rescore_company` (regex prefilter, hides matches that stop fitting), `ingest_tenders` hides them too, `mute_tender_word`
30. `people_membership_pan` — `people.membership_no`, `people.pan` (partner details in tender formats)
31. `tender_doc_chunks_cleanup` — trigger `tender_doc_jobs_drop_chunks` (`private.drop_collected_chunks`) deletes a job's chunks when it becomes `collected` (applied with execute_sql in parts)
32. `doc_prefetch_and_admin_captcha` (applied with execute_sql in parts) — `tender_doc_jobs.auto`; `answer_doc_captcha` allows platform admins; `admin_doc_captchas`; `push_on_doc_job` sends captchas to platform admins only, prefetches quiet; `doc_job_claim(key, runner, portal)`; trigger `tender_matches_prefetch` / `private.queue_prefetch`; `private.expire_prefetches` (cron `expire_doc_prefetches`, 03:17 UTC)
33. `assistant_eval_force` (execute_sql) — `tender_matches.forced_at`, `forced_by`, `forced_note`, `tech_eval`; price_book `tech_marking` (29), `assistant_chat` (3)
34. `sales_scheduling` (execute_sql in parts) — `leads.address`; tables `sales_reps`, `meeting_types`, `meetings`, `booking_links`, `travel_cache` (RLS: members read, writers write); `private.rep_free`; public `booking_view(token)` / `book_by_token(token, start, note)` for the client booking page (anon)
35. `meeting_to_crm` (execute_sql) — trigger `t_meeting_crm` on `meetings` (insert / status) → `private.meeting_to_crm`: timeline entry with the salesperson, deal moved to or opened at "Meeting"; `book_by_token` no longer writes the timeline itself
36. `health_checks` (execute_sql) — `private.health_checks`, `public.health_report(key, results)` (worker key), `private.health_run()` (pg_net → `/api/health`); `app_config.app_url` set to the live address
37. `lead_autopilot_and_crm_automation` (execute_sql in parts) — `leads.cost_credits`; deal stages + `called`, `link_sent`; `private.spend_sys`, `private.import_core` (import_leads wraps it); tables `lead_autopilot`, `autopilot_runs`; `autopilot_cost_per_lead`, `autopilot_claim`, `autopilot_import`, `private.autopilot_kick`, `autopilot_run_now`, cron `lead_autopilot_daily`; `private.stage_rank`, `private.advance_deal`, `on_deal_stage` (lead status mapping); triggers `t_lead_crm`, `t_message_crm`, `t_link_crm`; `meeting_to_crm` uses advance_deal; `source_results`; existing leads given a deal at New (demo ones registered in demo_seed)
38. `google_ads_and_reviews` (execute_sql in parts) — leads source `google_ads` (check + `import_core`); `google_ads_hooks`, `google_ads_hook_new`, `google_ads_lead`; `review_settings`, `review_requests`, `gbp_snapshots`; trigger `t_won_review`; `private.send_review_requests` (cron `send_review_requests`), `review_click`; `health_report` sets `app_config.email_ready`; cron `health_daily`
39. `strict_tender_matching_and_spend` (execute_sql) — `source_spend`, `source_results_v2`; `tender_pack_not` split (`ca_audit` works words, `ca_audit_hard` always-block); `tender_match_words` honours `strong` rules and `_hard`; `tender_fits` needs words when services are chosen and lets strong phrases override `allowed_packs`; `private.rescore_core` (+ closed/demo clean-up), `rescore_company` wraps it; GSC's rules regenerated from `rulesFor()`
40. `tender_ai_check` (execute_sql) — `tender_matches.ai_fit/ai_reason/ai_checked_at/ai_by`, `tender_preferences.ai_check` (on for GSC), price_book `tender_ai_check`; `ai_check_claim`, `ai_check_report`, `set_ai_fit`, `private.ai_check_kick`, `ai_check_now`, cron `tender_ai_check` (:27 hourly)
