import {
  json,
  requireBrokerSession,
  supabaseDelete,
  supabasePatch,
  supabaseSelect
} from '../../server/_broker-platform.mjs';
import {
  buildUpdateSavedFilterPayload,
  extractSavedFilterIdFromUrl,
  sanitizeSavedFilterRecord
} from '../../server/_saved-filters.mjs';

async function fetchOwnedSavedFilter(context, id) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'saved_filters',
    select: '*',
    filters: {
      id,
      user_id: context.broker.id
    },
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

  return Array.isArray(rows) ? rows[0] : null;
}

async function updateSavedFilter(request) {
  const context = await requireBrokerSession(request);
  const id = extractSavedFilterIdFromUrl(request.url);
  if (!id) {
    return json({ message: 'Saved filter id is required.' }, 400);
  }

  const existing = await fetchOwnedSavedFilter(context, id);
  if (!existing) {
    return json({ message: 'Saved filter not found.' }, 404);
  }

  const body = await request.json().catch(() => ({}));
  const payload = buildUpdateSavedFilterPayload(body, existing);
  const updated = await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'saved_filters',
    filters: {
      id,
      user_id: context.broker.id
    },
    payload
  });

  return json({
    savedFilter: sanitizeSavedFilterRecord(Array.isArray(updated) ? updated[0] : existing)
  });
}

async function deleteSavedFilter(request) {
  const context = await requireBrokerSession(request);
  const id = extractSavedFilterIdFromUrl(request.url);
  if (!id) {
    return json({ message: 'Saved filter id is required.' }, 400);
  }

  const existing = await fetchOwnedSavedFilter(context, id);
  if (!existing) {
    return json({ message: 'Saved filter not found.' }, 404);
  }

  await supabaseDelete({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'saved_filters',
    filters: {
      id,
      user_id: context.broker.id
    }
  });

  return json({ success: true });
}

export default async function handler(request) {
  try {
    if (request.method === 'PATCH') {
      return await updateSavedFilter(request);
    }

    if (request.method === 'DELETE') {
      return await deleteSavedFilter(request);
    }

    return json({ message: 'Method not allowed.' }, 405);
  } catch (error) {
    return json(
      { message: error?.message || 'Saved filters request failed.' },
      error?.status || 500
    );
  }
}
