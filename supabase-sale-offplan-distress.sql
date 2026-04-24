alter table public.broker_properties
  add column if not exists sale_property_status text,
  add column if not exists handover_quarter text,
  add column if not exists handover_year text,
  add column if not exists market_price text,
  add column if not exists distress_gap_percent text;

alter table public.public_listings
  add column if not exists sale_property_status text,
  add column if not exists handover_quarter text,
  add column if not exists handover_year text,
  add column if not exists market_price text,
  add column if not exists distress_gap_percent text;

create index if not exists broker_properties_sale_property_status_idx
  on public.broker_properties (sale_property_status);

create index if not exists public_listings_sale_property_status_idx
  on public.public_listings (sale_property_status);

with property_meta as (
  select
    id,
    case
      when description like '__BC_PROPERTY_META__:%'
        then substring(description from char_length('__BC_PROPERTY_META__:') + 1)::jsonb
      else null
    end as meta
  from public.broker_properties
)
update public.broker_properties as properties
set
  sale_property_status = coalesce(
    nullif(trim(properties.sale_property_status), ''),
    case
      when lower(trim(coalesce(properties.purpose, ''))) = 'sale'
        then coalesce(nullif(trim(property_meta.meta ->> 'salePropertyStatus'), ''), 'Ready Property')
      else null
    end
  ),
  handover_quarter = coalesce(
    nullif(trim(properties.handover_quarter), ''),
    nullif(trim(property_meta.meta ->> 'handoverQuarter'), '')
  ),
  handover_year = coalesce(
    nullif(trim(properties.handover_year), ''),
    nullif(regexp_replace(coalesce(property_meta.meta ->> 'handoverYear', ''), '[^0-9]', '', 'g'), '')
  ),
  market_price = coalesce(
    nullif(trim(properties.market_price), ''),
    nullif(trim(property_meta.meta ->> 'marketPrice'), '')
  ),
  distress_gap_percent = coalesce(
    nullif(trim(properties.distress_gap_percent), ''),
    nullif(trim(property_meta.meta ->> 'distressDiscountPercent'), ''),
    case
      when coalesce(properties.is_distress, false)
        and nullif(trim(coalesce(properties.market_price, property_meta.meta ->> 'marketPrice', '')), '') is not null
        and nullif(trim(coalesce(properties.price, '')), '') is not null
        and regexp_replace(coalesce(properties.market_price, property_meta.meta ->> 'marketPrice', ''), '[^0-9.]', '', 'g') <> ''
        and regexp_replace(coalesce(properties.price, ''), '[^0-9.]', '', 'g') <> ''
        and (regexp_replace(coalesce(properties.market_price, property_meta.meta ->> 'marketPrice', ''), '[^0-9.]', '', 'g'))::numeric > (regexp_replace(coalesce(properties.price, ''), '[^0-9.]', '', 'g'))::numeric
      then round((
        (
          (regexp_replace(coalesce(properties.market_price, property_meta.meta ->> 'marketPrice', ''), '[^0-9.]', '', 'g'))::numeric
          - (regexp_replace(coalesce(properties.price, ''), '[^0-9.]', '', 'g'))::numeric
        )
        / nullif((regexp_replace(coalesce(properties.market_price, property_meta.meta ->> 'marketPrice', ''), '[^0-9.]', '', 'g'))::numeric, 0)
      ) * 100)::text
      else properties.distress_gap_percent
    end
  )
from property_meta
where properties.id = property_meta.id;

update public.public_listings as listings
set
  sale_property_status = coalesce(nullif(trim(listings.sale_property_status), ''), nullif(trim(properties.sale_property_status), '')),
  handover_quarter = coalesce(nullif(trim(listings.handover_quarter), ''), nullif(trim(properties.handover_quarter), '')),
  handover_year = coalesce(nullif(trim(listings.handover_year), ''), nullif(trim(properties.handover_year), '')),
  market_price = coalesce(nullif(trim(listings.market_price), ''), nullif(trim(properties.market_price), '')),
  distress_gap_percent = coalesce(nullif(trim(listings.distress_gap_percent), ''), nullif(trim(properties.distress_gap_percent), ''))
from public.broker_properties as properties
where listings.source_type = 'property'
  and listings.source_id = properties.id
  and (
    nullif(trim(listings.sale_property_status), '') is null
    or nullif(trim(listings.handover_quarter), '') is null
    or nullif(trim(listings.handover_year), '') is null
    or nullif(trim(listings.market_price), '') is null
    or nullif(trim(listings.distress_gap_percent), '') is null
  );
