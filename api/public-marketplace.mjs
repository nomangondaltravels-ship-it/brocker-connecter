import {
  getSupabaseConfig,
  json,
  sanitizePublicListing,
  supabaseSelect
} from './_broker-platform.mjs';

function applySectionFilter(rows, section) {
  const items = Array.isArray(rows) ? rows : [];
  switch (section) {
    case 'shared-leads':
      return items.filter(item => item.source_type === 'lead');
    case 'shared-properties':
      return items.filter(item => item.source_type === 'property' && !item.is_urgent && !item.is_distress);
    case 'urgent-deals':
      return items.filter(item => item.source_type === 'property' && item.is_urgent);
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
      return json({ message: 'Missing required environment variables for public marketplace.' }, 500);
    }

    const section = new URL(request.url).searchParams.get('section') || 'all';
    const rows = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      filters: {
        public_listing_status: 'listed'
      },
      order: { column: 'updated_at', ascending: false }
    });

    const filtered = applySectionFilter(rows, section).map(sanitizePublicListing);
    return json({ listings: filtered });
  } catch (error) {
    return json({ message: error.message || 'Public marketplace load failed.' }, 500);
  }
}
