-- 91 (26 Nov): AI spend from worker routes is logged again. Worker routes (hourly AI tender check, voice turns) use
-- the anonymous client; the ai_usage insert policy only lets signed-in members write, so every row was refused
-- silently and nothing was logged after 2 Nov. Workers now log through this function with their key.
create or replace function public.ai_usage_log(p_key text, p_row jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.outreach_key_ok(p_key) then perform private.check_ingest_key(p_key); end if;
  insert into public.ai_usage (tenant_id, task, provider, model, input_tokens, output_tokens, cost_usd, ok, note)
  values (nullif(p_row->>'tenant_id', '')::uuid, left(p_row->>'task', 60), left(p_row->>'provider', 30), left(p_row->>'model', 80),
    coalesce((p_row->>'input_tokens')::int, 0), coalesce((p_row->>'output_tokens')::int, 0), coalesce((p_row->>'cost_usd')::numeric, 0),
    coalesce((p_row->>'ok')::boolean, false), left(p_row->>'note', 300));
end $$;
revoke all on function public.ai_usage_log(text, jsonb) from public;
grant execute on function public.ai_usage_log(text, jsonb) to anon, authenticated;
