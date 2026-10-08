# Dhandha — handover notes for Claude Code

Dhandha (धंधा) is a multi-tenant SaaS "one stop business generation suite" being built by CA Ankit Garg to sell to other businesses.

It covers:
- tenders: crawl, read, fill and file
- a document Vault, so users are never asked for the same document twice
- annexures printed on the customer's letterhead with their signature
- lead scraping
- a CRM
- social posts and AI video
- central ML shared across users
- billing: a small subscription plus pay-as-you-go credits

## Stack and hosting
- **Next.js 16** (App Router, plain JS). `proxy.js` replaces middleware. Server actions use `useActionState`.
- **Vercel** project `dhandha`, team `caa-nkit-garg-sit-ools`. Pushing to `main` deploys to production.
- **Supabase** project `umyesrpibsdgzsrqfvqf` (Mumbai, Pro plan).
  - Postgres with row-level security per tenant.
  - Auth with TOTP 2FA (AAL2 is required for `/app`).
  - Storage for files.
  - Client is `@supabase/ssr`; the URL and publishable key are in `lib/config.js`.
- **GitHub:** `caankitgargsitools/dhandha`.
- **Secrets** live only in Vercel Environment Variables (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and so on), never in code or chat.

## Ground rules from the owner
1. **Cost order is always free → cheaper → costlier.**
   - Tender reading: the free rule engine first (`lib/tenderRules.js`), then Gemini free tier, then Claude Haiku, then Claude Sonnet. See `lib/ai.js`.
   - The Gemini free tier may train on what it receives, so it only ever gets public tender documents (`private:false`). Customer private data goes to paid tiers only (`private:true`).
2. **Own crawler only.** No aggregator or third-party tender data services. Code is in `crawler/` (Node + Playwright; GePNIC and GeM adapters). Never bypass captchas.
3. **Signatures need the admin's TOTP code.** Signature and seal go on a PDF only after the admin enters it, and every use is logged (`log_signature_use`). Drafts carry a "DRAFT – NOT SIGNED" watermark.
4. **No credentials in chat.** Never ask for passwords or keys.
5. **Prefer non-destructive database changes.** Disable roles, revoke flags or ban users instead of deleting rows.
6. **Dummy data must be removable.** Every demo row is registered in `public.demo_seed(table_name,row_id)` so it can be removed before go-live.
7. **Answer in chat.** The owner wants answers inline in chat rather than as separate documents. Ask questions one at a time, with Yes/No/Skip or multiple-choice options.

## Map of the code
- `lib/session.js`: `getContext()` (user, tenant, role, company switcher, 2FA check). `lib/admin.js` holds the platform-admin context.
- `lib/taxonomy.js`: 10 industries → 29 sub-industries → 65 services, mapped to keywords and industry pack. Used by "What we do" at `/app/tenders/preferences`.
- Tender engine:
  - `lib/bidpack.js`: PDF bid pack on the letterhead.
  - `lib/pdftext.js` and `lib/tenderRules.js`: free reading.
  - `lib/tenderAi.js`: AI reading.
  - `lib/formatLibrary.js` and `lib/formatAi.js`: tender format filling.
  - Gap questions save their answers to `company_facts`.
- Tender pages: `app/app/tenders/*`. Actions are in `bidActions.js`, `readActions.js`, `formatActions.js`.
- Admin panel: `app/admin/*`. Covers tenants, people, credits, tickets, pricing, audit, crawler keys and AI spend.
- Database logic lives mostly in SQL. The migrations list is in `supabase/README.md`.
  - Key functions: `score_tender` (CPWD norms), `tender_fits`, `kw_rx` (whole-word matching, plurals allowed), `allowed_packs`, `rescore_company`, `ingest_tenders`, `spend_credits`, `add_team_member`, `claim_invites`.
- Roles: admin, manager, bid_preparer, telecaller, field, viewer, disabled.
- Design system ("bahi-khata" ledger look):
  - Colours: madder #8c1d2f, marigold #f0a202, ink #1b2240.
  - Fonts: Bricolage Grotesque, Manrope, Tiro Devanagari Hindi.
  - Charts are hand-drawn SVG in `components/Charts.js`.
- Tests: `node --test tests/` and `cd crawler && npm test`.

## Done so far
- **Phase 0:** auth, tenants, credits, admin, tickets, tasks, team invites.
- **Phase 1:** tender engine.
  - Preferences, eligibility scoring, the crawler intake (`ingest_tenders`), reading, format filling, the gap window and bid packs.
- Industry and services picker.

## Still to do
- Desktop helper for DSC-assisted submission.
- Crawler hosting on Oracle Always Free (the owner sets up the server).
- Phase 3: lead engine and CRM outreach.
- Phase 4: social content and AI video.
- Google Drive OAuth for document storage.
- Razorpay billing.
- Before launch:
  - Remove dummy data using `demo_seed`.
  - Enable leaked-password protection in Supabase.
