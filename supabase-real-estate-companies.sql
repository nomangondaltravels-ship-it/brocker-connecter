create extension if not exists pgcrypto;

create table if not exists public.real_estate_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'approved',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pending_real_estate_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  submitted_by_user_id uuid null references public.brokers(id) on delete set null,
  source text not null default 'registration_form',
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz null,
  reviewed_by text null
);

create index if not exists real_estate_companies_name_idx
  on public.real_estate_companies (name);

create unique index if not exists real_estate_companies_name_normalized_uidx
  on public.real_estate_companies ((lower(trim(name))));

create index if not exists pending_real_estate_companies_name_idx
  on public.pending_real_estate_companies (name);

create unique index if not exists pending_real_estate_companies_pending_name_uidx
  on public.pending_real_estate_companies ((lower(trim(name))))
  where status = 'pending';

alter table public.real_estate_companies
  drop constraint if exists real_estate_companies_status_check;

alter table public.real_estate_companies
  add constraint real_estate_companies_status_check
  check (status in ('approved'));

alter table public.pending_real_estate_companies
  drop constraint if exists pending_real_estate_companies_status_check;

alter table public.pending_real_estate_companies
  add constraint pending_real_estate_companies_status_check
  check (status in ('pending', 'approved', 'rejected'));

insert into public.real_estate_companies (name, status, created_at, updated_at)
select seeded.name, 'approved', timezone('utc', now()), timezone('utc', now())
from (
  values
    ('Xsite Real Estate'),
    ('Emaar Properties'),
    ('DAMAC Properties'),
    ('Nakheel'),
    ('Sobha Realty'),
    ('Azizi Developments'),
    ('Binghatti Developers'),
    ('Ellington Properties'),
    ('Danube Properties'),
    ('MAG Property Development'),
    ('Deyaar'),
    ('Meraas'),
    ('Dubai Properties'),
    ('Tiger Group'),
    ('Select Group'),
    ('Omniyat'),
    ('Imtiaz Developments'),
    ('Reportage Properties'),
    ('Samana Developers'),
    ('Nshama'),
    ('Arada'),
    ('Union Properties'),
    ('Wasl Properties'),
    ('Al Habtoor Group'),
    ('Allsopp & Allsopp'),
    ('Betterhomes'),
    ('Driven Properties'),
    ('fam Properties'),
    ('haus & haus'),
    ('Metropolitan Premium Properties'),
    ('AX Capital'),
    ('LuxuryProperty.com'),
    ('Espace Real Estate'),
    ('D&B Properties'),
    ('White & Co Real Estate'),
    ('Coldwell Banker UAE'),
    ('Engel & Volkers Dubai'),
    ('Provident Estate'),
    ('Seven Century Real Estate'),
    ('Key One Realty'),
    ('Hamptons International'),
    ('Asteco Property Management'),
    ('Chestertons MENA'),
    ('Cluttons Middle East'),
    ('BlackBrick Property'),
    ('Prime Capital Real Estate'),
    ('Springfield Real Estate'),
    ('Zooma Properties'),
    ('Rocky Real Estate'),
    ('A1 Properties'),
    ('Harbor Real Estate'),
    ('Roots Land Real Estate'),
    ('Aeon & Trisl'),
    ('Vibgyor Real Estate'),
    ('Casa Nostra Real Estate'),
    ('Prestige Luxury Real Estate'),
    ('Paragon Properties'),
    ('Powerhouse Real Estate'),
    ('Exclusive Links Real Estate'),
    ('Gold Mark Real Estate'),
    ('Texture Properties'),
    ('Unique Properties'),
    ('Sky View Real Estate'),
    ('Capri Realty'),
    ('Homes 4 Life Real Estate'),
    ('Binayah Real Estate'),
    ('Penthouse.ae'),
    ('Square Yards UAE'),
    ('Raine & Horne UAE'),
    ('Bluechip Real Estate'),
    ('Fidu Properties'),
    ('Indus Real Estate'),
    ('Savills Middle East'),
    ('Union Square House'),
    ('The Urban Nest'),
    ('McCone Properties'),
    ('Driven Forbes Global Properties'),
    ('Stone House Real Estate'),
    ('Aqua Properties'),
    ('Range International Property Investments'),
    ('La Capitale Real Estate'),
    ('CRC Property'),
    ('MNA Properties'),
    ('Better Livings Real Estate'),
    ('Iconic Realty'),
    ('Novel Homes Properties'),
    ('Hive Network Real Estate'),
    ('XO Property'),
    ('Anchors Real Estate'),
    ('Levante Real Estate'),
    ('Premier Estates'),
    ('Morgan''s International Realty'),
    ('Banke International Properties'),
    ('WaterWorld Real Estate'),
    ('RealCO Capital Real Estate'),
    ('Patriot Real Estate'),
    ('Fortune 4 Real Estate'),
    ('Pangea Properties'),
    ('Allegiance Real Estate'),
    ('Bluebells Luxury Real Estate'),
    ('Keymax Real Estate'),
    ('Embayt Real Estate'),
    ('Billionaire Homes Real Estate'),
    ('Royal Link Properties'),
    ('Dacha Real Estate'),
    ('Top Apartments Real Estate')
) as seeded(name)
where not exists (
  select 1
  from public.real_estate_companies company
  where lower(trim(company.name)) = lower(trim(seeded.name))
);
