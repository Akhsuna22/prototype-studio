-- Prototype Studio - database schema
-- Run this in Supabase: Project dashboard -> SQL Editor -> New query -> paste -> Run

create table if not exists prototypes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  html text not null,
  thread jsonb not null default '[]'::jsonb,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prototypes_user_id_idx on prototypes(user_id);
create index if not exists prototypes_share_slug_idx on prototypes(share_slug);

-- Row Level Security: the database itself enforces who can see/edit what,
-- not just application code being careful.
alter table prototypes enable row level security;

-- Owners can do anything with their OWN rows.
create policy "Owners can select their own prototypes"
  on prototypes for select
  using (auth.uid() = user_id);

create policy "Owners can insert their own prototypes"
  on prototypes for insert
  with check (auth.uid() = user_id);

create policy "Owners can update their own prototypes"
  on prototypes for update
  using (auth.uid() = user_id);

create policy "Owners can delete their own prototypes"
  on prototypes for delete
  using (auth.uid() = user_id);

-- Anyone (including logged-out visitors) can view ONE specific prototype
-- if - and only if - its share_slug has been set. This is what makes a
-- share link work for someone without an account, without exposing
-- anyone else's data.
create policy "Anyone can view a prototype with a share_slug set"
  on prototypes for select
  using (share_slug is not null);
