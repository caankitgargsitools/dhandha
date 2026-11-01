-- 71 (1 Nov 2026; applied with execute_sql): watchdog. Every 30 minutes private.health_watch() checks the moving parts and
-- pushes the platform admins only when something is wrong — each problem at most once in 6 hours (app_config watch_<key>):
--   worker   document jobs waiting 15+ min and nothing done by the AWS worker for 20 min
--   harvest  10+ study / format-harvest fetches failed in the last hour
--   precheck 10+ fetched tenders not read for 45 min
--   learn    20+ readings not learned for 3 h
--   ai       15+ failed AI calls in the last hour
--   crawl    no tender seen by the crawler for 9 h
-- The function body is in the database (pg_get_functiondef('private.health_watch'::regproc)).
select cron.schedule('health_watch', '*/30 * * * *', 'select private.health_watch()');
