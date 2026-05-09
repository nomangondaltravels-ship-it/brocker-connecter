-- NexBridge monthly rent listing foundation.
-- Safe to run more than once. It only adds missing columns and indexes.

alter table if exists public.broker_properties
  add column if not exists monthly_rent_price numeric,
  add column if not exists bills_included boolean not null default false,
  add column if not exists furnished_status text,
  add column if not exists available_from date,
  add column if not exists minimum_stay text,
  add column if not exists chiller_included boolean not null default false,
  add column if not exists internet_included boolean not null default false,
  add column if not exists dewa_included boolean not null default false,
  add column if not exists security_deposit numeric,
  add column if not exists payment_terms text,
  add column if not exists availability_status text not null default 'available',
  add column if not exists expiry_date date;

alter table if exists public.public_listings
  add column if not exists monthly_rent_price numeric,
  add column if not exists bills_included boolean not null default false,
  add column if not exists furnished_status text,
  add column if not exists available_from date,
  add column if not exists minimum_stay text,
  add column if not exists chiller_included boolean not null default false,
  add column if not exists internet_included boolean not null default false,
  add column if not exists dewa_included boolean not null default false,
  add column if not exists security_deposit numeric,
  add column if not exists payment_terms text,
  add column if not exists availability_status text not null default 'available',
  add column if not exists expiry_date date;

create index if not exists broker_properties_monthly_rent_idx
  on public.broker_properties (broker_uuid, purpose, availability_status, expiry_date);

create index if not exists public_listings_monthly_rent_idx
  on public.public_listings (purpose, availability_status, expiry_date)
  where source_type = 'property' and public_listing_status = 'listed';

create index if not exists public_listings_marketplace_section_idx
  on public.public_listings (source_type, purpose, is_distress, public_listing_status, updated_at desc);

-- Distress deals are intentionally sale-only. Keep old accidental rent distress
-- flags from leaking into public marketplace sections.
update public.broker_properties
set is_distress = false,
    distress_gap_percent = null,
    market_price = null
where coalesce(lower(purpose), '') <> 'sale'
  and coalesce(is_distress, false) = true;

update public.public_listings
set is_distress = false,
    distress_gap_percent = null,
    market_price = null
where source_type = 'property'
  and coalesce(lower(purpose), '') <> 'sale'
  and coalesce(is_distress, false) = true;
