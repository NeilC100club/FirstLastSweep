-- ---------------------------------------------------------------------------
-- Club organisers (October 2026).
-- The super user appoints organisers to clubs. Organisers only see and run
-- their own club's sweeps; buyers see their own club's page and badge.
-- All card payments now go to the main Stripe account.
--
-- Run this ONCE in Supabase: SQL Editor > New query > paste all of it > Run.
-- Safe to run again.
-- ---------------------------------------------------------------------------

-- 1. Each club gets a short web address, e.g. /c/gvd
alter table clubs add column if not exists slug text;
update clubs set slug = 'newport-county' where short_name = 'Newport County' and slug is null;
update clubs set slug = 'gvd' where short_name = 'GVD' and slug is null;
update clubs set slug = lower(regexp_replace(short_name, '[^a-zA-Z0-9]+', '-', 'g')) where slug is null;
create unique index if not exists clubs_slug_key on clubs (slug);

-- 2. Who organises which club (a person can run several clubs, a club can have several organisers)
create table if not exists club_organisers (
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
alter table club_organisers enable row level security;

drop policy if exists "Organisers can see their own clubs" on club_organisers;
create policy "Organisers can see their own clubs"
  on club_organisers for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create or replace function organises_club(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from club_organisers where club_id = p_club_id and user_id = auth.uid());
$$;

-- 3. Only the super user, or an organiser of that club, can create a sweep for it
drop policy if exists "Organisers can create their own sweeps" on sweeps;
create policy "Organisers can create their own sweeps"
  on sweeps for insert
  to authenticated
  with check (auth.uid() = organizer_id and (is_admin() or organises_club(club_id)));

-- Organisers of a club can run any of that club's sweeps (lock, enter result)
drop policy if exists "Club organisers can update their club's sweeps" on sweeps;
create policy "Club organisers can update their club's sweeps"
  on sweeps for update
  to authenticated
  using (organises_club(club_id));

-- 4. Remember which club a buyer belongs to, so their dashboard wears its badge
alter table profiles add column if not exists home_club_id uuid references clubs(id) on delete set null;

-- 5. Security fix: people may only change their own name and home club — never
--    their payout or admin details.
revoke update on profiles from authenticated, anon;
grant update (name, home_club_id) on profiles to authenticated;

-- 6. Storage for club badges uploaded from the super user screen
insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do nothing;
