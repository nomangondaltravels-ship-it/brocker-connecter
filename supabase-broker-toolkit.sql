create extension if not exists pgcrypto;

create table if not exists public.toolkit_tools (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null,
  url text not null,
  logo_url text null,
  icon_name text null,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.toolkit_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.brokers(id) on delete cascade,
  tool_id uuid not null references public.toolkit_tools(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.toolkit_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.brokers(id) on delete cascade,
  tool_id uuid not null references public.toolkit_tools(id) on delete cascade,
  clicked_at timestamptz not null default timezone('utc', now())
);

create index if not exists toolkit_tools_category_idx
  on public.toolkit_tools (category);

create index if not exists toolkit_tools_active_idx
  on public.toolkit_tools (is_active);

create index if not exists toolkit_tools_sort_idx
  on public.toolkit_tools (sort_order, created_at desc);

create unique index if not exists toolkit_tools_title_normalized_uidx
  on public.toolkit_tools ((lower(trim(title))));

create unique index if not exists toolkit_favorites_user_tool_uidx
  on public.toolkit_favorites (user_id, tool_id);

create index if not exists toolkit_favorites_tool_idx
  on public.toolkit_favorites (tool_id);

create index if not exists toolkit_clicks_tool_idx
  on public.toolkit_clicks (tool_id, clicked_at desc);

create index if not exists toolkit_clicks_user_idx
  on public.toolkit_clicks (user_id, clicked_at desc);

insert into public.toolkit_tools (
  title,
  description,
  category,
  url,
  logo_url,
  icon_name,
  is_active,
  is_featured,
  sort_order,
  created_at,
  updated_at
)
select
  seeded.title,
  seeded.description,
  seeded.category,
  seeded.url,
  seeded.logo_url,
  seeded.icon_name,
  true,
  seeded.is_featured,
  seeded.sort_order,
  timezone('utc', now()),
  timezone('utc', now())
from (
  values
    ('Dubai Land Department', 'Official Dubai Land Department portal for property services, public information, and e-services.', 'Government & Compliance', 'https://dubailand.gov.ae/en/', null, 'DLD', true, 10),
    ('RERA', 'Official Real Estate Regulatory Agency page for regulations, service access, and public guidance.', 'DLD / RERA', 'https://dubailand.gov.ae/en/rera/', null, 'RERA', true, 20),
    ('Trakheesi', 'Official Trakheesi access point for permit-related real estate advertising and brokerage workflows.', 'Trakheesi', 'https://trakheesi.dubailand.gov.ae/Account/LoginRedirectUrl.aspx', null, 'TR', true, 30),
    ('Ejari', 'Official DLD Ejari registration and renewal service guidance for rental contract workflows.', 'Ejari', 'https://dubailand.gov.ae/en/eservices/register-renew-ejari-contract/', null, 'EJ', true, 40),
    ('Dubai REST', 'Official Dubai REST service page for real estate transactions, lease services, and smart access.', 'DLD / RERA', 'https://dubailand.gov.ae/eservices/dubai-rest/', null, 'REST', true, 50),
    ('DEWA', 'Dubai Electricity and Water Authority official portal for utility services and account access.', 'Utilities', 'https://www.dewa.gov.ae/en/', null, 'DEWA', false, 60),
    ('Empower', 'Official Empower district cooling portal for Dubai customer service and account information.', 'Utilities', 'https://www.empower.ae/', null, 'EMP', false, 70),
    ('Emicool', 'Official Emicool district cooling website for customer service and utility support.', 'Utilities', 'https://www.emicool.com/', null, 'EMI', false, 80),
    ('Etisalat', 'Official e& UAE portal for telecom services, home internet, and account management.', 'Utilities', 'https://www.etisalat.ae/en/', null, 'E&', false, 90),
    ('Du', 'Official du portal for telecom plans, broadband, and mobile services in the UAE.', 'Utilities', 'https://www.du.ae/', null, 'du', false, 100),
    ('Property Finder', 'Property portal for listing discovery, market research, and real estate lead sourcing.', 'Property Portals', 'https://www.propertyfinder.ae/en/', null, 'PF', true, 110),
    ('Bayut', 'Property portal for market discovery, listing visibility, and UAE property browsing.', 'Property Portals', 'https://www.bayut.com/', null, 'BY', false, 120),
    ('Dubizzle', 'Marketplace portal used widely in the UAE for property search and listing discovery.', 'Property Portals', 'https://dubai.dubizzle.com/', null, 'DZ', false, 130),
    ('A2A Agreement Guide', 'Editable placeholder link for broker-to-broker agreement guidance and internal reference.', 'Forms & Agreements', 'https://example.com/broker-toolkit/a2a-agreement-guide', null, 'A2A', false, 140),
    ('Form A Guide', 'Editable placeholder link for Form A guidance until a preferred reference URL is confirmed.', 'Forms & Agreements', 'https://example.com/broker-toolkit/form-a-guide', null, 'A', false, 150),
    ('Form B Guide', 'Editable placeholder link for Form B guidance until a preferred reference URL is confirmed.', 'Forms & Agreements', 'https://example.com/broker-toolkit/form-b-guide', null, 'B', false, 160),
    ('Form F Guide', 'Editable placeholder link for Form F guidance until a preferred reference URL is confirmed.', 'Forms & Agreements', 'https://example.com/broker-toolkit/form-f-guide', null, 'F', false, 170),
    ('Form I Guide', 'Editable placeholder link for Form I guidance until a preferred reference URL is confirmed.', 'Forms & Agreements', 'https://example.com/broker-toolkit/form-i-guide', null, 'I', false, 180),
    ('ROI Calculator', 'Editable placeholder link for ROI calculation and investment return planning.', 'Calculators', 'https://example.com/broker-toolkit/roi-calculator', null, 'ROI', false, 190),
    ('Mortgage Calculator', 'Editable placeholder link for mortgage estimate workflows and financing planning.', 'Calculators', 'https://example.com/broker-toolkit/mortgage-calculator', null, 'MC', false, 200),
    ('Service Charge Guide', 'Official DLD service charge index service page for jointly owned property fee guidance.', 'Calculators', 'https://dubailand.gov.ae/en/eservices/service-charge-index-overview/', null, 'SCI', false, 210)
) as seeded(title, description, category, url, logo_url, icon_name, is_featured, sort_order)
where not exists (
  select 1
  from public.toolkit_tools tools
  where lower(trim(tools.title)) = lower(trim(seeded.title))
);
