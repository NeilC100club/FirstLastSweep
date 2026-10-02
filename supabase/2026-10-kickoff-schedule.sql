-- ---------------------------------------------------------------------------
-- Auto-close at kick-off: runs every minute inside Supabase and pings the app,
-- which locks any board whose kick-off has passed and emails the PDF to buyers.
--
-- BEFORE RUNNING: replace PASTE-CRON-SECRET-HERE below with the same value you
-- saved in Vercel as CRON_SECRET. Then run it once in the Supabase SQL editor.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any earlier version of the job so this can be re-run safely.
select cron.unschedule(jobid) from cron.job where jobname = 'sweep-kickoff';

select cron.schedule(
  'sweep-kickoff',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://first-last-sweep.vercel.app/api/cron/kickoff',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE-CRON-SECRET-HERE')
  );
  $$
);
