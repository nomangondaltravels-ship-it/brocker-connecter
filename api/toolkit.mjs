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
  seedDefaultToolkitTools,
  sanitizeToolkitToolInput
} from '../server/_toolkit.mjs';

const TOOLKIT_ROUTE_TIMEOUT_MS = 1600;
const TOOLKIT_ANALYTICS_TIMEOUT_MS = 900;

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
  try {
    await seedDefaultToolkitTools({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      signal
    });
  } catch (error) {
    if (!isToolkitRelationError(error)) {
      throw error;
    }
  }

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

function normalizeToolkitMatchValue(value) {
  return normalizeText(value).trim().toLowerCase();
}

async function findExistingToolkitTool(context, { toolId = '', title = '', url = '', signal } = {}) {
  const rows = await listToolkitTools(context, { includeInactive: true, signal }).catch(() => []);
  const normalizedToolId = normalizeText(toolId);
  if (normalizedToolId) {
    const exact = rows.find(item => item.id === normalizedToolId);
    if (exact) return exact;
  }

  const normalizedTitle = normalizeToolkitMatchValue(title);
  if (normalizedTitle) {
    const titleMatch = rows.find(item => normalizeToolkitMatchValue(item.title) === normalizedTitle);
    if (titleMatch) return titleMatch;
  }

  const normalizedUrl = normalizeToolkitMatchValue(url);
  if (normalizedUrl && normalizedUrl !== '#') {
    const urlMatch = rows.find(item => normalizeToolkitMatchValue(item.url) === normalizedUrl);
    if (urlMatch) return urlMatch;
  }

  return null;
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

async function buildAdminToolkitPayload(context, options = {}) {
  const useTimeouts = options.useTimeouts !== false;
  const fallbackTools = getDefaultToolkitRows();
  const loadTools = signal => listToolkitTools(context, { includeInactive: true, signal }).catch(error => {
    if (isToolkitRelationError(error)) return null;
    throw error;
  });
  const toolsResult = useTimeouts
    ? await withTimeout(loadTools, TOOLKIT_ROUTE_TIMEOUT_MS, null)
    : await loadTools();

  const mergedTools = mergeToolkitRows(
    Array.isArray(toolsResult) ? toolsResult : [],
    toolsResult === null ? fallbackTools : []
  );

  const loadAnalytics = async signal => {
    const [favorites, clicks] = await Promise.all([
      listAllToolkitFavorites(context, signal).catch(() => []),
      listToolkitClicks(context, signal).catch(() => [])
    ]);
    return { favorites, clicks };
  };
  const analyticsResult = useTimeouts
    ? await withTimeout(loadAnalytics, TOOLKIT_ANALYTICS_TIMEOUT_MS, {
        favorites: [],
        clicks: []
      })
    : await loadAnalytics().catch(() => ({
        favorites: [],
        clicks: []
      }));

  const analytics = buildToolkitAnalytics({
    tools: mergedTools,
    favorites: analyticsResult.favorites,
    clicks: analyticsResult.clicks
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

  const existingTool = await findExistingToolkitTool(context, {
    title: payload.title,
    url: payload.url
  });

  if (existingTool?.id) {
    await supabasePatch({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      table: 'toolkit_tools',
      filters: { id: existingTool.id },
      payload: {
        ...payload,
        updated_at: new Date().toISOString()
      }
    });
  } else {
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
  }

  return json(await buildAdminToolkitPayload(context, { useTimeouts: false }));
}

async function updateTool(request) {
  const context = await requireAdmin(request);
  const body = await request.json().catch(() => ({}));
  const toolId = normalizeText(body?.toolId);
  const { payload, error } = validateToolkitToolPayload(body);
  if (error) {
    return json({ message: error }, 400);
  }

  const existingTool = await findExistingToolkitTool(context, {
    toolId,
    title: payload.title,
    url: payload.url
  });

  if (existingTool?.id) {
    await supabasePatch({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      table: 'toolkit_tools',
      filters: { id: existingTool.id },
      payload: {
        ...payload,
        updated_at: new Date().toISOString()
      }
    });
  } else {
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
  }

  return json(await buildAdminToolkitPayload(context, { useTimeouts: false }));
}

async function deleteTool(request) {
  const context = await requireAdmin(request);
  const body = await request.json().catch(() => ({}));
  const toolId = normalizeText(body?.toolId || new URL(request.url).searchParams.get('toolId'));
  const fallbackTitle = normalizeText(body?.title);
  const fallbackUrl = normalizeText(body?.url);
  const existingTool = await findExistingToolkitTool(context, {
    toolId,
    title: fallbackTitle,
    url: fallbackUrl
  });

  if (existingTool?.id) {
    await supabaseDelete({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      table: 'toolkit_tools',
      filters: { id: existingTool.id }
    });
  } else if (fallbackTitle) {
    await supabaseInsert({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      table: 'toolkit_tools',
      payload: {
        title: fallbackTitle,
        description: normalizeText(body?.description) || 'Toolkit item hidden by admin.',
        category: normalizeText(body?.category) || 'Company / Broker Tools',
        url: fallbackUrl || '#',
        logo_url: normalizeText(body?.logoUrl || body?.logo_url) || null,
        icon_name: normalizeText(body?.iconName || body?.icon_name) || null,
        is_active: false,
        is_featured: false,
        sort_order: Number.isFinite(Number(body?.sortOrder ?? body?.sort_order)) ? Number(body?.sortOrder ?? body?.sort_order) : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }).catch(async error => {
      const message = String(error?.message || '').toLowerCase();
      if (!message.includes('duplicate')) {
        throw error;
      }
      const matchedTool = await findExistingToolkitTool(context, {
        title: fallbackTitle,
        url: fallbackUrl
      });
      if (matchedTool?.id) {
        await supabasePatch({
          supabaseUrl: context.supabaseUrl,
          serviceRoleKey: context.serviceRoleKey,
          table: 'toolkit_tools',
          filters: { id: matchedTool.id },
          payload: {
            is_active: false,
            updated_at: new Date().toISOString()
          }
        });
      }
      return [];
    });
  }

  return json(await buildAdminToolkitPayload(context, { useTimeouts: false }));
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
