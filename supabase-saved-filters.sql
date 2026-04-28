-- Saved Filters backend for NexBridge
-- Run this in Supabase SQL Editor before deploying the new API routes.

create extension if not exists pgcrypto;

create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.brokers(id) on delete cascade,
  name text not null,
  type text not null default 'all' check (type in ('listing', 'requirement', 'distress', 'all')),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_filters_user_id_idx
  on public.saved_filters (user_id);

create index if not exists saved_filters_user_type_idx
  on public.saved_filters (user_id, type);

create or replace function public.set_saved_filters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_filters_set_updated_at on public.saved_filters;
create trigger saved_filters_set_updated_at
before update on public.saved_filters
for each row
execute function public.set_saved_filters_updated_at();

alter table public.saved_filters enable row level security;

drop policy if exists "Saved filters owner select" on public.saved_filters;
drop policy if exists "Saved filters owner insert" on public.saved_filters;
drop policy if exists "Saved filters owner update" on public.saved_filters;
drop policy if exists "Saved filters owner delete" on public.saved_filters;

create policy "Saved filters owner select"
on public.saved_filters
for select
to authenticated
using (auth.uid() = user_id);

create policy "Saved filters owner insert"
on public.saved_filters
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Saved filters owner update"
on public.saved_filters
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Saved filters owner delete"
on public.saved_filters
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_filters to authenticated;
