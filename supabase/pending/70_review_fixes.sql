-- 70 (1 Nov 2026, portal code review; applied with execute_sql):
-- * private.format_harvest_queue: GeM study jobs no longer count as open format-harvest jobs (see 67, updated there).
-- * format_learn_release(key, reads[]): readings whose formats could not be stored are handed back (learned_at null).
-- * doc_job_claim(key, runner, portal): harvest / study jobs are claimed after customers' prefetches.
create or replace function public.format_learn_release(p_key text, p_reads uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  update public.tender_reads set learned_at = null where id = any(p_reads[1:100]);
end $$;
grant execute on function public.format_learn_release(text, uuid[]) to anon, authenticated;

create or replace function public.doc_job_claim(p_key text, p_runner text, p_portal text) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare v_id uuid; r jsonb;
begin
  perform private.check_ingest_key(p_key);
  update public.tender_doc_jobs set status = 'failed', error = 'The crawler stopped responding', updated_at = now()
  where status in ('running','captcha') and updated_at < now() - interval '10 minutes';
  select j.id into v_id from public.tender_doc_jobs j join public.tenders t on t.id = j.tender_id
  where j.status = 'queued' and j.created_at > now() - interval '6 hours'
  order by j.auto, (j.detail->>'purpose' = 'harvest') nulls first, (t.portal is distinct from p_portal), j.created_at limit 1 for update of j skip locked;
  if v_id is null then return null; end if;
  update public.tender_doc_jobs set status = 'running', runner = left(p_runner, 60), step = 'Opening the portal', updated_at = now() where id = v_id;
  select jsonb_build_object('id', j.id, 'portal', t.portal, 'tender_ref', t.tender_ref, 'title', t.title, 'authority', t.authority, 'department', t.department, 'auto', j.auto)
    into r from public.tender_doc_jobs j join public.tenders t on t.id = j.tender_id where j.id = v_id;
  return r;
end $function$;
