import {
  json,
  requireBrokerSession,
  supabaseInsert,
  supabaseSelect
} from '../../server/_broker-platform.mjs';
import {
  buildCreateSavedFilterPayload,
  sanitizeSavedFilterRecord
} from '../../server/_saved-filters.mjs';

async function listSavedFilters(request) {
  const context = await requireBrokerSession(request);
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'saved_filters',
    select: '*',
    filters: { user_id: context.broker.id },
    order: { column: 'updated_at', ascending: false }
  }).catch(error => {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('saved_filters') || message.includes('relation')) {
      const relationError = new Error('Saved filters database is not ready yet.');
      relationError.status = 503;
      throw relationError;
    }
    throw error;
  });

  return json({
    savedFilters: (Array.isArray(rows) ? rows : [])
      .map(sanitizeSavedFilterRecord)
      .filter(Boolean)
  }, 200, { 'Cache-Control': 'no-store' });
}

async function createSavedFilter(request) {
  const context = await requireBrokerSession(request);
  const body = await request.json().catch(() => ({}));
  const payload = buildCreateSavedFilterPayload(body, context.broker.id);

  const inserted = await supabaseInsert({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'saved_filters',
    payload
  }).catch(error => {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('saved_filters') || message.includes('relation')) {
      const relationError = new Error('Saved filters database is not ready yet.');
      relationError.status = 503;
      throw relationError;
    }
    throw error;
  });

  return json({
    savedFilter: sanitizeSavedFilterRecord(Array.isArray(inserted) ? inserted[0] : null)
  }, 201);
}

export default async function handler(request) {
  try {
    if (request.method === 'GET') {
      return await listSavedFilters(request);
    }

    if (request.method === 'POST') {
      return await createSavedFilter(request);
    }

    return json({ message: 'Method not allowed.' }, 405);
  } catch (error) {
    return json(
      { message: error?.message || 'Saved filters request failed.' },
      error?.status || 500
    );
  }
}
