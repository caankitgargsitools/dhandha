-- 72 (1 Nov 2026, portal security review; applied with execute_sql — bodies are in the database):
-- 1. spend_credits: quantity must be > 0 and <= 10,000 (a negative quantity added credits). Ledger checked: never used.
-- 2. Invite links: private.invite_confirmations(user_id, tenant_id) records which workspace's link confirmed an account;
--    confirm_invited_signup records it; claim_invites joins only those workspaces for invite-confirmed accounts;
--    add_team_member sends such an account this workspace's invite link instead of adding it directly.
--    signIn (app/login/actions.js) records a further workspace's link when the person signs in from it.
-- 3. tender_matches: direct INSERT only for platform admins (matches are made by upsert_match / ingest as owner);
--    trigger b_match_keys_fixed stops a match's tender / company / workspace from being changed.
-- 4. Trigger b_lead_same_company (private.lead_same_company) on 17 tables with lead_id + company_id: a row may only
--    point at a lead of its own company (quotes, sales_invoices, voice_sessions, crm_activities, deals, meetings …).
-- 5. revoke execute from public, anon, authenticated: push_followups(), push_tender_digest(), push_kick_if_due(),
--    tender_match_words(uuid,uuid); from public, anon: autopilot_cost_per_lead(uuid), outreach_kick().
-- Follow-ups (not yet done): shared tender fields (apply_tender_read / set_tender_conditions) can still be changed by any
-- workspace that has a real match — move per-workspace readings off the shared row; tender-docs storage reads are not
-- scoped by workspace (public tender documents, low risk).
alter policy "writers insert" on public.tender_matches with check (public.is_platform_admin());
revoke execute on function public.push_followups(), public.push_tender_digest(), public.push_kick_if_due(), public.tender_match_words(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.autopilot_cost_per_lead(uuid), public.outreach_kick() from public, anon;
