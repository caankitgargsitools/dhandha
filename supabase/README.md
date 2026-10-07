# Database

Migrations are applied to Supabase project `umyesrpibsdgzsrqfvqf` (Mumbai). Phase 0 migrations:

1. `phase0_core_schema` — profiles, tenants, members, companies, facts, document catalogue, documents, experience, people, brand assets, signature log, modules, price book, subscriptions, wallets, credit ledger, invoices, audit log
2. `phase0_rls_triggers_rpcs` — Row Level Security per tenant, audit triggers, `create_workspace`, `add_company`, `spend_credits`, `log_signature_use`, private `brand` storage bucket
3. `phase0_seed_catalogue_and_prices` — modules, draft rate card, document catalogue
4. `phase0_tighten_function_grants`, `fix_audit_row_company_id`
