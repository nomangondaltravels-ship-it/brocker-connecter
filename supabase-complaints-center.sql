create extension if not exists pgcrypto;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.brokers(id) on delete set null,
  reporter_email text,
  reporter_name text,
  reported_user_id uuid references public.brokers(id) on delete set null,
  reported_broker_id uuid references public.brokers(id) on delete set null,
  reported_broker_id_number text,
  reported_broker_name text,
  listing_id bigint references public.broker_properties(id) on delete set null,
  requirement_id bigint references public.broker_leads(id) on delete set null,
  target_type text not null default 'broker',
  target_id text not null default '',
  target_label text,
  source_section text,
  reason text not null default 'Other',
  description text not null default '',
  proof_url text,
  status text not null default 'new',
  admin_note text,
  action_taken text not null default 'none',
  reviewed_by text,
  reviewed_at timestamptz,
  name text,
  broker text,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.complaints add column if not exists reporter_id uuid;
alter table public.complaints add column if not exists reporter_email text;
alter table public.complaints add column if not exists reporter_name text;
alter table public.complaints add column if not exists reported_user_id uuid;
alter table public.complaints add column if not exists reported_broker_id uuid;
alter table public.complaints add column if not exists reported_broker_id_number text;
alter table public.complaints add column if not exists reported_broker_name text;
alter table public.complaints add column if not exists listing_id bigint;
alter table public.complaints add column if not exists requirement_id bigint;
alter table public.complaints add column if not exists target_type text not null default 'broker';
alter table public.complaints add column if not exists target_id text not null default '';
alter table public.complaints add column if not exists target_label text;
alter table public.complaints add column if not exists source_section text;
alter table public.complaints add column if not exists reason text not null default 'Other';
alter table public.complaints add column if not exists description text not null default '';
alter table public.complaints add column if not exists proof_url text;
alter table public.complaints add column if not exists admin_note text;
alter table public.complaints add column if not exists action_taken text not null default 'none';
alter table public.complaints add column if not exists reviewed_by text;
alter table public.complaints add column if not exists reviewed_at timestamptz;
alter table public.complaints add column if not exists created_at timestamptz not null default now();
alter table public.complaints add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_target_type_check'
  ) then
    alter table public.complaints
      add constraint complaints_target_type_check
      check (target_type in ('listing', 'requirement', 'broker'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_status_check'
  ) then
    alter table public.complaints
      add constraint complaints_status_check
      check (status in ('new', 'under-review', 'resolved', 'rejected'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_action_taken_check'
  ) then
    alter table public.complaints
      add constraint complaints_action_taken_check
      check (action_taken in ('none', 'warning', 'restrict', 'block', 'delete_listing', 'delete_requirement'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_reporter_fk'
  ) then
    alter table public.complaints
      add constraint complaints_reporter_fk
      foreign key (reporter_id) references public.brokers(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_reported_user_fk'
  ) then
    alter table public.complaints
      add constraint complaints_reported_user_fk
      foreign key (reported_user_id) references public.brokers(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_reported_broker_fk'
  ) then
    alter table public.complaints
      add constraint complaints_reported_broker_fk
      foreign key (reported_broker_id) references public.brokers(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_listing_fk'
  ) then
    alter table public.complaints
      add constraint complaints_listing_fk
      foreign key (listing_id) references public.broker_properties(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_requirement_fk'
  ) then
    alter table public.complaints
      add constraint complaints_requirement_fk
      foreign key (requirement_id) references public.broker_leads(id) on delete set null;
  end if;
end $$;

create index if not exists complaints_reporter_id_idx on public.complaints(reporter_id);
create index if not exists complaints_reported_user_id_idx on public.complaints(reported_user_id);
create index if not exists complaints_reported_broker_id_idx on public.complaints(reported_broker_id);
create index if not exists complaints_target_type_idx on public.complaints(target_type);
create index if not exists complaints_target_id_idx on public.complaints(target_id);
create index if not exists complaints_listing_id_idx on public.complaints(listing_id);
create index if not exists complaints_requirement_id_idx on public.complaints(requirement_id);
create index if not exists complaints_status_idx on public.complaints(status);
create index if not exists complaints_action_taken_idx on public.complaints(action_taken);
create index if not exists complaints_created_at_idx on public.complaints(created_at desc);
create index if not exists complaints_reason_idx on public.complaints(reason);

create or replace function public.touch_complaints_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists complaints_touch_updated_at on public.complaints;
create trigger complaints_touch_updated_at
before update on public.complaints
for each row
execute function public.touch_complaints_updated_at();

create or replace view public.complaint_repeat_offense_summary as
select
  coalesce(reported_broker_id, reported_user_id) as broker_id,
  count(*) filter (
    where status in ('new', 'under-review', 'resolved')
  ) as valid_complaint_count,
  count(*) filter (where action_taken = 'warning') as warning_count,
  count(*) filter (where action_taken = 'restrict') as restriction_count,
  count(*) filter (where action_taken = 'block') as block_count,
  max(created_at) as latest_complaint_at,
  case
    when count(*) filter (where status in ('new', 'under-review', 'resolved')) >= 5 then 'block'
    when count(*) filter (where status in ('new', 'under-review', 'resolved')) >= 3 then 'restrict'
    when count(*) filter (where status in ('new', 'under-review', 'resolved')) >= 1 then 'warning'
    else 'none'
  end as suggested_action
from public.complaints
where coalesce(reported_broker_id, reported_user_id) is not null
group by coalesce(reported_broker_id, reported_user_id);

comment on table public.complaints is 'Complaint Center records for broker-reported listings, requirements, and broker accounts.';
comment on view public.complaint_repeat_offense_summary is 'Aggregated valid complaint counts per reported broker to support warning, restriction, and block decisions.';
