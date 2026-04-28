import { normalizeText } from './_broker-platform.mjs';

const SAVED_FILTER_TYPES = new Set(['listing', 'requirement', 'distress', 'all']);
const MAX_FILTER_NAME_LENGTH = 80;

export function normalizeSavedFilterType(value, fallback = 'all') {
  const normalized = normalizeText(value).toLowerCase();
  return SAVED_FILTER_TYPES.has(normalized) ? normalized : fallback;
}

export function parseSavedFilterFilters(value) {
  if (!value) return {};

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  return isPlainObject(value) ? { ...value } : {};
}

export function sanitizeSavedFilterRecord(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: normalizeText(row.user_id),
    name: normalizeText(row.name),
    type: normalizeSavedFilterType(row.type),
    filters: parseSavedFilterFilters(row.filters),
    createdAt: normalizeText(row.created_at),
    updatedAt: normalizeText(row.updated_at || row.created_at)
  };
}

export function buildCreateSavedFilterPayload(body, userId) {
  const name = sanitizeSavedFilterName(body?.name);
  if (!name) {
    const error = new Error('Saved filter name is required.');
    error.status = 400;
    throw error;
  }

  return {
    user_id: normalizeText(userId),
    name,
    type: normalizeSavedFilterType(body?.type),
    filters: parseSavedFilterFilters(body?.filters),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function buildUpdateSavedFilterPayload(body, existingRow) {
  const payload = {
    updated_at: new Date().toISOString()
  };

  if (body?.name !== undefined) {
    const name = sanitizeSavedFilterName(body?.name);
    if (!name) {
      const error = new Error('Saved filter name is required.');
      error.status = 400;
      throw error;
    }
    payload.name = name;
  }

  if (body?.type !== undefined) {
    payload.type = normalizeSavedFilterType(body?.type, normalizeSavedFilterType(existingRow?.type));
  }

  if (body?.filters !== undefined) {
    payload.filters = parseSavedFilterFilters(body?.filters);
  }

  if (Object.keys(payload).length === 1) {
    const error = new Error('No saved filter changes were provided.');
    error.status = 400;
    throw error;
  }

  return payload;
}

export function extractSavedFilterIdFromUrl(url) {
  const pathname = new URL(url).pathname;
  const parts = pathname.split('/').filter(Boolean);
  return normalizeText(parts[parts.length - 1]);
}

function sanitizeSavedFilterName(value) {
  return normalizeText(value).slice(0, MAX_FILTER_NAME_LENGTH);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
