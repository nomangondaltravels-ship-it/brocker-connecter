import {
  json,
  requiredEnv,
  supabaseSelect
} from './_broker-platform.mjs';
import {
  getCuratedApprovedCompanyRows,
  mergeCompanyRows,
  parseCompanyRow
} from './_real_estate_companies.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return json({ message: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const fallbackRows = getCuratedApprovedCompanyRows();

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ companies: fallbackRows });
  }

  try {
    const rows = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'real_estate_companies',
      select: '*',
      filters: { status: 'approved' },
      order: { column: 'name', ascending: true }
    }).catch(() => []);

    const companies = mergeCompanyRows(
      (Array.isArray(rows) ? rows : []).map(parseCompanyRow),
      fallbackRows
    );
    return json({ companies });
  } catch (error) {
    return json({ companies: fallbackRows });
  }
}
