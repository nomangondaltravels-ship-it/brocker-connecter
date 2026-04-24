import {
  getBearerToken,
  json,
  normalizeText,
  requiredEnv,
  requireBrokerSession,
  supabaseDelete,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
  verifyToken
} from '../server/_broker-platform.mjs';
import {
  buildToolkitAnalytics,
  getDefaultToolkitRows,
  isValidToolkitUrl,
  mergeToolkitRows,
  parseToolkitToolRow,
  sanitizeToolkitToolInput
} from '../server/_toolkit.mjs';

const TOOLKIT_ROUTE_TIMEOUT_MS = 2200;

async function withTimeout(task, timeoutMs, fallbackValue) {
  const controller = new AbortController();
  let timer = null;
  try {
    timer = setTimeout(() => controller.abort(), timeoutMs);
    return await Promise.resolve().then(() => task(controller.signal));
  } catch (error) {
    if (error?.name === 'AbortError') {
      return fallbackValue;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isToolkitRelationError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('toolkit_tools')
    || message.includes('toolkit_favorites')
    || message.includes('toolkit_clicks')
    || message.includes('relation')
    || message.includes('column');
}

async function requireAdmin(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !sessionSecret) {
    const error = new Error('Missing required environment variables for toolkit manager.');
    error.status = 500;
    throw error;
  }
  const token = getBearerToken(request);
  const tokenPayload = verifyToken(token, sessionSecret);
  if (!tokenPayload?.u) {
    const error = new Error('Admin login token is missing or invalid.');
    error.status = 401;
    throw error;
  }
  return {
    supabaseUrl,
    serviceRoleKey,
    reviewerLabel: normalizeText(tokenPayload?.u) || 'admin'
  };
}

async function listToolkitTools(context, { includeInactive = false, signal } = {}) {
  const filters = includeInactive ? {} : { is_active: 'eq.true' };
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'toolkit_tools',
    select: '*',
    filters,
    order: { column: 'sort_order', ascending: true },
    signal
  });
  return (Array.isArray(rows) ? rows : []).map(parseToolkitToolRow);
}

async function listToolkitFavorites(context, brokerId, signal) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'toolkit_favorites',
    select: '*',
    filters: { user_id: brokerId },
    order: { column: 'created_at', ascending: false },
    signal
  });
  return Array.isArray(rows) ? rows : [];
}

async function listAllToolkitFavorites(context, signal) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'toolkit_favorites',
    select: '*',
    order: { column: 'created_at', ascending: false },
    signal
  });
  return Array.isArray(rows) ? rows : [];
}

async function listToolkitClicks(context, signal) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'toolkit_clicks',
    select: '*',
    order: { column: 'clicked_at', ascending: false },
    signal
  });
  return Array.isArray(rows) ? rows : [];
}

async function buildBrokerToolkitPayload(context) {
  const fallbackTools = getDefaultToolkitRows();
  const dbTools = await withTimeout(
    signal => listToolkitTools(context, { includeInactive: false, signal }),
    TOOLKIT_ROUTE_TIMEOUT_MS,
    null
  ).catch(error => {
    if (isToolkitRelationError(error)) return null;
    throw error;
  });

  const tools = mergeToolkitRows(
    Array.isArray(dbTools) ? dbTools : [],
    dbTools === null ? fallbackTools : []
  ).filter(item => item.isActive);

  let favoriteToolIds = [];
  try {
    const favorites = await withTimeout(
      signal => listToolkitFavorites(context, context.broker.id, signal),
      TOOLKIT_ROUTE_TIMEOUT_MS,
      []
    );
    favoriteToolIds = (Array.isArray(favorites) ? favorites : [])
      .map(item => normalizeText(item.tool_id || item.toolId))
      .filter(Boolean);
  } catch (error) {
    favoriteToolIds = [];
  }

  return {
    tools,
    favoriteToolIds
  };
}

async function buildAdminToolkitPayload(context) {
  const fallbackTools = getDefaultToolkitRows();
  const result = await withTimeout(async signal => {
    const [tools, favorites, clicks] = await Promise.all([
      listToolkitTools(context, { includeInactive: true, signal }).catch(error => {
        if (isToolkitRelationError(error)) return null;
        throw error;
      }),
      listAllToolkitFavorites(context, signal).catch(() => []),
      listToolkitClicks(context, signal).catch(() => [])
    ]);
    return { tools, favorites, clicks };
  }, TOOLKIT_ROUTE_TIMEOUT_MS, {
    tools: [],
    favorites: [],
    clicks: []
  });

  const mergedTools = mergeToolkitRows(
    Array.isArray(result.tools) ? result.tools : [],
    result.tools === null ? fallbackTools : []
  );
  const analytics = buildToolkitAnalytics({
    tools: mergedTools,
    favorites: result.favorites,
    clicks: result.clicks
  });

  return {
    tools: analytics.tools,
    analytics: {
      totalTools: analytics.totalTools,
      activeTools: analytics.activeTools,
      totalClicks: analytics.totalClicks,
      mostUsedTools: analytics.mostUsedTools
    }
  };
}

async function toggleFavorite(request) {
  const context = await requireBrokerSession(request);
  const body = await request.json().catch(() => ({}));
  const toolId = normalizeText(body?.toolId);
  const favorite = body?.favorite !== undefined ? Boolean(body.favorite) : true;
  if (!toolId) {
    return json({ message: 'Toolkit tool is missing.' }, 400);
  }

  const dbTools = await listToolkitTools(context, { includeInactive: true }).catch(() => []);
  const toolExists = (Array.isArray(dbTools) ? dbTools : []).some(item => item.id === toolId);
  if (!toolExists) {
    return json({ message: 'Toolkit tool not found.' }, 404);
  }

  if (favorite) {
    await supabaseInsert({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      table: 'toolkit_favorites',
      payload: {
        user_id: context.broker.id,
        tool_id: toolId,
        created_at: new Date().toISOString()
      }
    }).catch(error => {
      if (!String(error?.message || '').toLowerCase().includes('duplicate')) {
        throw error;
      }
      return [];
    });
  } else {
    await supabaseDelete({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      table: 'toolkit_favorites',
      filters: {
        user_id: context.broker.id,
        tool_id: toolId
      }
    }).catch(() => []);
  }

  const favorites = await listToolkitFavorites(context, context.broker.id).catch(() => []);
  return json({
    favoriteToolIds: (Array.isArray(favorites) ? favorites : [])
      .map(item => normalizeText(item.tool_id || item.toolId))
      .filter(Boolean)
  });
}

async function trackClick(request) {
  const context = await requireBrokerSession(request);
  const body = await request.json().catch(() => ({}));
  const toolId = normalizeText(body?.toolId);
  if (!toolId) {
    return json({ message: 'Toolkit tool is missing.' }, 400);
  }

  await supabaseInsert({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'toolkit_clicks',
    payload: {
      user_id: context.broker.id,
      tool_id: toolId,
      clicked_at: new Date().toISOString()
    }
  }).catch(() => []);

  return json({ success: true });
}

function validateToolkitToolPayload(body) {
  const payload = sanitizeToolkitToolInput(body);
  if (!payload.title) {
    return { error: 'Tool title is required.' };
  }
  if (!payload.description) {
    return { error: 'Tool description is required.' };
  }
  if (!payload.url || !isValidToolkitUrl(payload.url)) {
    return { error: 'A valid external URL is required.' };
  }
  return { payload };
}

async function createTool(request) {
  const context = await requireAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { payload, error } = validateToolkitToolPayload(body);
  if (error) {
    return json({ message: error }, 400);
  }

  await supabaseInsert({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'toolkit_tools',
    payload: {
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });

  return json(await buildAdminToolkitPayload(context));
}

async function updateTool(request) {
  const context = await requireAdmin(request);
  const body = await request.json().catch(() => ({}));
  const toolId = normalizeText(body?.toolId);
  if (!toolId) {
    return json({ message: 'Toolkit tool is missing.' }, 400);
  }
  const { payload, error } = validateToolkitToolPayload(body);
  if (error) {
    return json({ message: error }, 400);
  }

  await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'toolkit_tools',
    filters: { id: toolId },
    payload: {
      ...payload,
      updated_at: new Date().toISOString()
    }
  });

  return json(await buildAdminToolkitPayload(context));
}

async function deleteTool(request) {
  const context = await requireAdmin(request);
  const body = await request.json().catch(() => ({}));
  const toolId = normalizeText(body?.toolId || new URL(request.url).searchParams.get('toolId'));
  if (!toolId) {
    return json({ message: 'Toolkit tool is missing.' }, 400);
  }

  await supabaseDelete({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'toolkit_tools',
    filters: { id: toolId }
  });

  return json(await buildAdminToolkitPayload(context));
}

export default async function handler(request) {
  try {
    if (request.method === 'GET') {
      const scope = new URL(request.url).searchParams.get('scope');
      if (scope === 'admin') {
        const context = await requireAdmin(request);
        return json(await buildAdminToolkitPayload(context), 200, { 'Cache-Control': 'no-store' });
      }
      const context = await requireBrokerSession(request);
      return json(await buildBrokerToolkitPayload(context), 200, { 'Cache-Control': 'no-store' });
    }

    if (request.method === 'POST') {
      const body = await request.clone().json().catch(() => ({}));
      const action = normalizeText(body?.action).toLowerCase();
      if (action === 'toggle-favorite') return await toggleFavorite(request);
      if (action === 'track-click') return await trackClick(request);
      if (action === 'create-tool') return await createTool(request);
      return json({ message: 'Toolkit action is not supported.' }, 400);
    }

    if (request.method === 'PATCH') {
      return await updateTool(request);
    }

    if (request.method === 'DELETE') {
      return await deleteTool(request);
    }

    return json({ message: 'Method not allowed.' }, 405);
  } catch (error) {
    return json({ message: error?.message || 'Toolkit request failed.' }, error?.status || 500);
  }
}
