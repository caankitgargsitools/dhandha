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
