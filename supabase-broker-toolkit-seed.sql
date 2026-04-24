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
    ('Dubai Land Department', 'Official Dubai Land Department portal for real estate services and information.', 'Government & Compliance', 'https://dubailand.gov.ae', null, 'DLD', true, 10),
    ('RERA', 'Real Estate Regulatory Agency information and real estate regulation services.', 'DLD / RERA', 'https://dubailand.gov.ae', null, 'RERA', true, 20),
    ('Trakheesi', 'Access real estate advertisement permit and Trakheesi-related services.', 'Trakheesi', 'https://trakheesi.dubailand.gov.ae', null, 'TR', true, 30),
    ('Ejari', 'Ejari tenancy registration and related services.', 'Ejari', 'https://dubailand.gov.ae/en/eservices/ejari', null, 'EJ', true, 40),
    ('Dubai REST', 'Dubai REST app and real estate digital services.', 'Government & Compliance', 'https://dubailand.gov.ae/en/eservices/dubai-rest', null, 'REST', true, 50),
    ('DEWA', 'Dubai Electricity and Water Authority services.', 'Utilities', 'https://www.dewa.gov.ae', null, 'DEWA', false, 60),
    ('Empower', 'District cooling services and customer portal.', 'Utilities', 'https://www.empower.ae', null, 'EMP', false, 70),
    ('Emicool', 'District cooling services and customer support.', 'Utilities', 'https://www.emicool.com', null, 'EMI', false, 80),
    ('Etisalat by e&', 'Internet, telecom, and business services.', 'Utilities', 'https://www.etisalat.ae', null, 'E&', false, 90),
    ('du', 'Internet, telecom, and business services.', 'Utilities', 'https://www.du.ae', null, 'du', false, 100),
    ('Property Finder', 'Property listing and broker portal.', 'Property Portals', 'https://www.propertyfinder.ae', null, 'PF', true, 110),
    ('Bayut', 'UAE property portal for listings and leads.', 'Property Portals', 'https://www.bayut.com', null, 'BY', false, 120),
    ('Dubizzle', 'UAE classifieds and property listings.', 'Property Portals', 'https://dubai.dubizzle.com', null, 'DZ', false, 130),
    ('A2A Agreement Guide', 'Guide for agents to create agent-to-agent agreement before sharing details or arranging viewing.', 'Forms & Agreements', '#', null, 'A2A', false, 140),
    ('Form A Guide', 'Seller and broker agreement guidance.', 'Forms & Agreements', '#', null, 'A', false, 150),
    ('Form B Guide', 'Buyer and broker agreement guidance.', 'Forms & Agreements', '#', null, 'B', false, 160),
    ('Form F Guide', 'Sale agreement guidance between buyer and seller.', 'Forms & Agreements', '#', null, 'F', false, 170),
    ('Form I Guide', 'Agent-to-agent cooperation agreement guidance.', 'Forms & Agreements', '#', null, 'I', false, 180),
    ('ROI Calculator', 'Quick return on investment calculator for brokers and investors.', 'Calculators', '#', null, 'ROI', false, 190),
    ('Mortgage Calculator', 'Estimate mortgage payments and finance scenarios.', 'Calculators', '#', null, 'MC', false, 200),
    ('Service Charge Guide', 'Quick reference for service charge and owner cost checks.', 'Company / Broker Tools', '#', null, 'SCI', false, 210)
) as seeded(title, description, category, url, logo_url, icon_name, is_featured, sort_order)
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'toolkit_tools'
)
and not exists (
  select 1
  from public.toolkit_tools tools
  where lower(trim(tools.title)) = lower(trim(seeded.title))
     or (
       seeded.url <> '#'
       and lower(trim(coalesce(tools.url, ''))) = lower(trim(seeded.url))
     )
);
