-- ---------------------------------------------------------------------------
-- October 2026 upgrade: super user, cash allocations, editable boards,
-- auto-close at kick-off, PDF emails and archiving.
--
-- Run this ONCE in Supabase: SQL Editor > New query > paste all of it > Run.
-- It's safe to run again — every statement checks before it changes anything.
-- ---------------------------------------------------------------------------

-- 1. SUPER USERS ------------------------------------------------------------
-- A separate table (rather than a column on profiles) so nobody can make
-- themselves an admin by editing their own profile. Rows are only ever added
-- by hand from the SQL editor.
create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;

drop policy if exists "Users can see their own admin row" on admins;
create policy "Users can see their own admin row"
  on admins for select
  to authenticated
  using (user_id = auth.uid());

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- Admins can edit any sweep (lock it, enter the result, fix details).
drop policy if exists "Admins can update any sweep" on sweeps;
create policy "Admins can update any sweep"
  on sweeps for update
  to authenticated
  using (is_admin());

-- 2. CASH ALLOCATIONS -------------------------------------------------------
-- 'card' = paid through Stripe, 'cash' = written in by an organiser or admin.
alter table minutes add column if not exists payment_method text;
alter table minutes add column if not exists allocated_by uuid references profiles(id);
update minutes set payment_method = 'card'
  where payment_method is null and owner_name is not null;

-- 3. ARCHIVING + "PDF ALREADY EMAILED" FLAG ---------------------------------
alter table sweeps add column if not exists archived_at timestamptz;
alter table sweeps add column if not exists board_emailed_at timestamptz;

-- 4. AUTO-CLOSE AT KICK-OFF -------------------------------------------------
-- Locks every open board whose kick-off (UK time) has passed, and returns the
-- ids it locked. Called every minute by the app's /api/cron/kickoff endpoint.
create or replace function lock_due_sweeps()
returns setof uuid
language sql security definer set search_path = public
as $$
  update sweeps
     set status = 'locked'
   where status = 'open'
     and archived_at is null
     and event_date is not null
     and kickoff_time is not null
     and (event_date + kickoff_time) at time zone 'Europe/London' <= now()
  returning id;
$$;
revoke execute on function lock_due_sweeps() from public, anon, authenticated;
