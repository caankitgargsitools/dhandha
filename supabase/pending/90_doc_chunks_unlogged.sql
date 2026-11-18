-- 90 (18 Nov): the hand-over buffer for fetched tender files is UNLOGGED. Each fetch wrote megabytes into
-- tender_doc_chunks and the rows were deleted soon after; on busy days (350–450 fetches) that WAL traffic used up the
-- database's disk allowance and throttled everything (1–3 Nov, 16–17 Nov). The table only carries files from the
-- Mumbai worker to the app for minutes, so it needs no crash safety: after a crash its rows are empty and the jobs are
-- fetched again. Applied 18 Nov through a one-off pg_cron job (the change takes longer than the SQL tool's 60 s).
alter table public.tender_doc_chunks set unlogged;
