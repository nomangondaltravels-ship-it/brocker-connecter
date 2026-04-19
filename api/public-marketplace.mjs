import {
  getSupabaseConfig,
  json,
  sanitizePublicListing,
  supabaseSelect
} from './_broker-platform.mjs';

function applySectionFilter(rows, section) {
  const items = Array.isArray(rows) ? rows : [];
  switch (section) {
    case 'requirements':
    case 'broker-requirements':
    case 'shared-leads':
      return items.filter(item => item.source_type === 'lead');
    case 'marketplace':
    case 'broker-connector-listings':
    case 'shared-properties':
      return items
        .filter(item => item.source_type === 'property')
        .sort((left, right) => Number(Boolean(right.is_distress)) - Number(Boolean(left.is_distress)));
    case 'distress-deals':
      return items.filter(item => item.source_type === 'property' && item.is_distress);
    default:
      return items;
  }
}

export async function GET(request) {
  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ message: 'Missing required environment variables for Broker Connector Page.' }, 500);
    }

    const section = new URL(request.url).searchParams.get('section') || 'all';
    const rows = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      select: [
        'id',
        'broker_display_name',
        'broker_id_number',
        'broker_mobile',
        'source_type',
        'source_id',
        'listing_kind',
        'purpose',
        'property_type',
        'category',
        'location',
        'price_label',
        'size_label',
        'bedrooms',
        'bathrooms',
        'public_notes',
        'status',
        'is_urgent',
        'is_distress',
        'created_at',
        'updated_at'
      ].join(','),
      filters: {
        public_listing_status: 'listed'
      },
      order: { column: 'updated_at', ascending: false }
    });

    const filtered = applySectionFilter(rows, section).map(sanitizePublicListing);
    return json({ listings: filtered });
  } catch (error) {
    return json({ message: error.message || 'Broker Connector Page load failed.' }, 500);
  }
}
