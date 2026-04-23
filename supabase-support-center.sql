create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_broker_id uuid null references public.brokers(id) on delete set null,
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new',
  reviewed_by text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists support_requests_created_at_idx
  on public.support_requests (created_at desc);

create index if not exists support_requests_status_idx
  on public.support_requests (status);

alter table public.support_requests
  drop constraint if exists support_requests_status_check;

alter table public.support_requests
  add constraint support_requests_status_check
  check (status in ('new', 'in_progress', 'resolved'));
