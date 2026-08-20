-- Run this once in your Supabase project's SQL editor (Database > SQL Editor > New query).

-- One row per signed-up user, extending Supabase's built-in auth.users.
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  stripe_account_id text,
  stripe_onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Automatically create a profile row whenever someone signs up.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- One row per sweep.
create table if not exists sweeps (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references profiles(id) not null,
  name text not null,
  event_date date,
  kickoff_time time,
  price_per_minute integer not null, -- stored in pence
  total_minutes integer not null default 90,
  cause text,
  status text not null default 'open' check (status in ('open', 'locked', 'finished')),
  goal_minute_first integer,
  goal_minute_last integer,
  created_at timestamptz not null default now()
);

-- One row per minute on a sweep's board.
create table if not exists minutes (
  id uuid primary key default gen_random_uuid(),
  sweep_id uuid references sweeps(id) on delete cascade not null,
  minute integer not null,
  owner_name text,
  owner_id uuid references profiles(id),
  stripe_checkout_session_id text,
  purchased_at timestamptz,
  unique (sweep_id, minute) -- a minute can only belong to one buyer, ever
);

-- Row Level Security: everyone signed in can read sweeps/minutes (it's a shared board).
-- Writes to `minutes` only happen via the server (Stripe webhook), never directly from
-- the browser, so a buyer can't just mark a minute as theirs without actually paying.
alter table sweeps enable row level security;
alter table minutes enable row level security;
alter table profiles enable row level security;

create policy "Sweeps are viewable by anyone signed in"
  on sweeps for select
  to authenticated
  using (true);

create policy "Organisers can create their own sweeps"
  on sweeps for insert
  to authenticated
  with check (auth.uid() = organizer_id);

create policy "Organisers can update their own sweeps"
  on sweeps for update
  to authenticated
  using (auth.uid() = organizer_id);

create policy "Minutes are viewable by anyone signed in"
  on minutes for select
  to authenticated
  using (true);

create policy "Profiles are viewable by anyone signed in"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Helper: call this once from your app (or manually) after creating a sweep,
-- to pre-populate its minute rows 1..total_minutes.
create or replace function create_sweep_minutes(p_sweep_id uuid, p_total_minutes integer)
returns void as $$
begin
  insert into minutes (sweep_id, minute)
  select p_sweep_id, generate_series(1, p_total_minutes);
end;
$$ language plpgsql security definer;
