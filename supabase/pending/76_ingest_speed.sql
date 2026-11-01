-- Database overload, 1 Nov 2026 evening (statement timeouts everywhere from 12:16 UTC; applied ~14:35 UTC).
-- ingest_tenders re-matched every crawled tender against every company on every crawl, even unchanged ones, and every
-- batch locked the same ingest_keys row for its whole run (parallel crawls queued behind each other). Now: unchanged
-- tenders skip matching (preference changes are re-scored by rescore_company), and the key's last use is noted at most
-- every 5 minutes without waiting (skip locked).
do $$
declare d text;
  o1 text := $o$  update private.ingest_keys set last_used_at = now() where id = v_key;$o$;
  n1 text := $n$  -- note the key's use at most every 5 minutes and never wait for another batch holding it (parallel crawls)
  perform 1 from private.ingest_keys where id = v_key and coalesce(last_used_at, '-infinity') < now() - interval '5 minutes' for update skip locked;
  if found then update private.ingest_keys set last_used_at = now() where id = v_key; end if;$n$;
  o2 text := $o$      else
        update public.tenders set last_seen_at = now() where id = v_id;
      end if;
    end if;
    for c in select p.company_id from public.tender_preferences p loop$o$;
  n2 text := $n$      else
        update public.tenders set last_seen_at = now() where id = v_id;
        continue; -- unchanged since the last crawl: its matches are already right (preference changes re-score separately)
      end if;
    end if;
    for c in select p.company_id from public.tender_preferences p loop$n$;
begin
  d := pg_get_functiondef('public.ingest_tenders(text,text,jsonb)'::regprocedure);
  if position(o1 in d) > 0 and position(o2 in d) > 0 then
    d := replace(replace(d, o1, n1), o2, n2);
    execute d;
  end if;
end $$;
-- Study harvests paused while the database recovered (re-enable with active := true):
-- select cron.alter_job(jobid, active := false) from cron.job where jobname in ('gem_harvest','gem_harvest_wknd','format_harvest');
-- and gem_harvest_per_run lowered 30 → 10 in private.app_config.
