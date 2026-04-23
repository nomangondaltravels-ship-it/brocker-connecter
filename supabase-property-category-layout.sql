alter table public.broker_leads
  add column if not exists property_category text,
  add column if not exists unit_layout text;

alter table public.broker_properties
  add column if not exists property_category text,
  add column if not exists unit_layout text;

alter table public.public_listings
  add column if not exists property_category text,
  add column if not exists unit_layout text;

create index if not exists broker_leads_property_category_idx
  on public.broker_leads (property_category);

create index if not exists broker_leads_unit_layout_idx
  on public.broker_leads (unit_layout);

create index if not exists broker_properties_property_category_idx
  on public.broker_properties (property_category);

create index if not exists broker_properties_unit_layout_idx
  on public.broker_properties (unit_layout);

create index if not exists public_listings_property_category_idx
  on public.public_listings (property_category);

create index if not exists public_listings_unit_layout_idx
  on public.public_listings (unit_layout);

update public.broker_leads
set
  property_category = coalesce(
    nullif(trim(property_category), ''),
    case
      when lower(trim(coalesce(category, ''))) in ('studio', '1bhk', '1 bhk', '1br', '1 br', '1 bedroom', '2bhk', '2 bhk', '2br', '2 br', '2 bedroom', '3bhk', '3 bhk', '3br', '3 br', '3 bedroom', '4bhk', '4 bhk', '4br', '4 br', '4 bedroom', '5bhk', '5 bhk', '5br', '5 br', '5 bedroom', '5+bhk', '5+ bhk', '6bhk', '6 bhk', '6br', '6 br', '6 bedroom', '6+', '6+ bhk') then 'Apartment'
      when lower(trim(coalesce(category, ''))) in ('apartment', 'flat') then 'Apartment'
      when lower(trim(coalesce(category, ''))) = 'villa' then 'Villa'
      when lower(trim(coalesce(category, ''))) = 'townhouse' then 'Townhouse'
      when lower(trim(coalesce(category, ''))) = 'office' then 'Office'
      when lower(trim(coalesce(category, ''))) in ('shop', 'retail', 'shop / retail') then 'Shop / Retail'
      when lower(trim(coalesce(category, ''))) = 'warehouse' then 'Warehouse'
      when lower(trim(coalesce(category, ''))) in ('land', 'plot', 'land / plot') then 'Land / Plot'
      when nullif(trim(coalesce(category, '')), '') is not null then 'Other'
      else null
    end
  ),
  unit_layout = coalesce(
    nullif(trim(unit_layout), ''),
    case
      when lower(trim(coalesce(category, ''))) = 'studio' then 'Studio'
      when lower(trim(coalesce(category, ''))) in ('1bhk', '1 bhk', '1br', '1 br', '1 bedroom') then '1 BHK'
      when lower(trim(coalesce(category, ''))) in ('2bhk', '2 bhk', '2br', '2 br', '2 bedroom') then '2 BHK'
      when lower(trim(coalesce(category, ''))) in ('3bhk', '3 bhk', '3br', '3 br', '3 bedroom') then '3 BHK'
      when lower(trim(coalesce(category, ''))) in ('4bhk', '4 bhk', '4br', '4 br', '4 bedroom') then '4 BHK'
      when lower(trim(coalesce(category, ''))) in ('5bhk', '5 bhk', '5br', '5 br', '5 bedroom') then '5 BHK'
      when lower(trim(coalesce(category, ''))) in ('5+bhk', '5+ bhk', '6bhk', '6 bhk', '6br', '6 br', '6 bedroom', '6+', '6+ bhk') then '6+ BHK'
      when nullif(trim(coalesce(category, '')), '') is not null then 'N/A'
      else null
    end
  )
where nullif(trim(property_category), '') is null
   or nullif(trim(unit_layout), '') is null;

update public.broker_properties
set
  property_category = coalesce(
    nullif(trim(property_category), ''),
    case
      when lower(trim(coalesce(property_type, category, ''))) in ('studio', '1bhk', '1 bhk', '1br', '1 br', '1 bedroom', '2bhk', '2 bhk', '2br', '2 br', '2 bedroom', '3bhk', '3 bhk', '3br', '3 br', '3 bedroom', '4bhk', '4 bhk', '4br', '4 br', '4 bedroom', '5bhk', '5 bhk', '5br', '5 br', '5 bedroom', '5+bhk', '5+ bhk', '6bhk', '6 bhk', '6br', '6 br', '6 bedroom', '6+', '6+ bhk') then 'Apartment'
      when lower(trim(coalesce(property_type, category, ''))) in ('apartment', 'flat') then 'Apartment'
      when lower(trim(coalesce(property_type, category, ''))) = 'villa' then 'Villa'
      when lower(trim(coalesce(property_type, category, ''))) = 'townhouse' then 'Townhouse'
      when lower(trim(coalesce(property_type, category, ''))) = 'office' then 'Office'
      when lower(trim(coalesce(property_type, category, ''))) in ('shop', 'retail', 'shop / retail') then 'Shop / Retail'
      when lower(trim(coalesce(property_type, category, ''))) = 'warehouse' then 'Warehouse'
      when lower(trim(coalesce(property_type, category, ''))) in ('land', 'plot', 'land / plot') then 'Land / Plot'
      when nullif(trim(coalesce(property_type, category, '')), '') is not null then 'Other'
      else null
    end
  ),
  unit_layout = coalesce(
    nullif(trim(unit_layout), ''),
    case
      when lower(trim(coalesce(property_type, category, ''))) = 'studio' then 'Studio'
      when lower(trim(coalesce(property_type, category, ''))) in ('1bhk', '1 bhk', '1br', '1 br', '1 bedroom') then '1 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('2bhk', '2 bhk', '2br', '2 br', '2 bedroom') then '2 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('3bhk', '3 bhk', '3br', '3 br', '3 bedroom') then '3 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('4bhk', '4 bhk', '4br', '4 br', '4 bedroom') then '4 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('5bhk', '5 bhk', '5br', '5 br', '5 bedroom') then '5 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('5+bhk', '5+ bhk', '6bhk', '6 bhk', '6br', '6 br', '6 bedroom', '6+', '6+ bhk') then '6+ BHK'
      when nullif(trim(coalesce(property_type, category, '')), '') is not null then 'N/A'
      else null
    end
  )
where nullif(trim(property_category), '') is null
   or nullif(trim(unit_layout), '') is null;

update public.public_listings
set
  property_category = coalesce(
    nullif(trim(property_category), ''),
    case
      when lower(trim(coalesce(property_type, category, ''))) in ('studio', '1bhk', '1 bhk', '1br', '1 br', '1 bedroom', '2bhk', '2 bhk', '2br', '2 br', '2 bedroom', '3bhk', '3 bhk', '3br', '3 br', '3 bedroom', '4bhk', '4 bhk', '4br', '4 br', '4 bedroom', '5bhk', '5 bhk', '5br', '5 br', '5 bedroom', '5+bhk', '5+ bhk', '6bhk', '6 bhk', '6br', '6 br', '6 bedroom', '6+', '6+ bhk') then 'Apartment'
      when lower(trim(coalesce(property_type, category, ''))) in ('apartment', 'flat') then 'Apartment'
      when lower(trim(coalesce(property_type, category, ''))) = 'villa' then 'Villa'
      when lower(trim(coalesce(property_type, category, ''))) = 'townhouse' then 'Townhouse'
      when lower(trim(coalesce(property_type, category, ''))) = 'office' then 'Office'
      when lower(trim(coalesce(property_type, category, ''))) in ('shop', 'retail', 'shop / retail') then 'Shop / Retail'
      when lower(trim(coalesce(property_type, category, ''))) = 'warehouse' then 'Warehouse'
      when lower(trim(coalesce(property_type, category, ''))) in ('land', 'plot', 'land / plot') then 'Land / Plot'
      when nullif(trim(coalesce(property_type, category, '')), '') is not null then 'Other'
      else null
    end
  ),
  unit_layout = coalesce(
    nullif(trim(unit_layout), ''),
    case
      when lower(trim(coalesce(property_type, category, ''))) = 'studio' then 'Studio'
      when lower(trim(coalesce(property_type, category, ''))) in ('1bhk', '1 bhk', '1br', '1 br', '1 bedroom') then '1 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('2bhk', '2 bhk', '2br', '2 br', '2 bedroom') then '2 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('3bhk', '3 bhk', '3br', '3 br', '3 bedroom') then '3 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('4bhk', '4 bhk', '4br', '4 br', '4 bedroom') then '4 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('5bhk', '5 bhk', '5br', '5 br', '5 bedroom') then '5 BHK'
      when lower(trim(coalesce(property_type, category, ''))) in ('5+bhk', '5+ bhk', '6bhk', '6 bhk', '6br', '6 br', '6 bedroom', '6+', '6+ bhk') then '6+ BHK'
      when nullif(trim(coalesce(property_type, category, '')), '') is not null then 'N/A'
      else null
    end
  )
where nullif(trim(property_category), '') is null
   or nullif(trim(unit_layout), '') is null;
