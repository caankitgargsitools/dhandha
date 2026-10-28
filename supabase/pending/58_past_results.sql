-- Applied 28 Oct with execute_sql. See supabase/README.md item 64.
create index if not exists tender_awards_fts on public.tender_awards using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(authority,'')));
-- functions public.past_results(text,text,text,text,int,int) and public.similar_awards(uuid,int):
-- read the live definitions with  select pg_get_functiondef('public.past_results'::regproc);
