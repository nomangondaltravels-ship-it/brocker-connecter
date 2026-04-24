import {
  normalizeText
} from './_broker-platform.mjs';

export const TOOLKIT_CATEGORIES = Object.freeze([
  'Government & Compliance',
  'DLD / RERA',
  'Trakheesi',
  'Ejari',
  'Utilities',
  'Property Portals',
  'Forms & Agreements',
  'Calculators',
  'Company / Broker Tools'
]);

const TOOLKIT_CATEGORY_TOKENS = new Map(
  TOOLKIT_CATEGORIES.map(value => [normalizeToolkitToken(value), value])
);

function createDefaultTool({
  id,
  title,
  description,
  category,
  url,
  logoUrl = '',
  iconName = '',
  isFeatured = false,
  sortOrder = 0
}) {
  return {
    id,
    title,
    description,
    category,
    url,
    logoUrl,
    iconName,
    isActive: true,
    isFeatured,
    sortOrder,
    createdAt: '',
    updatedAt: ''
  };
}

export const DEFAULT_TOOLKIT_TOOLS = Object.freeze([
  createDefaultTool({
    id: 'seed-dld',
    title: 'Dubai Land Department',
    description: 'Official Dubai Land Department portal for property services, public information, and e-services.',
    category: 'Government & Compliance',
    url: 'https://dubailand.gov.ae/en/',
    iconName: 'DLD',
    isFeatured: true,
    sortOrder: 10
  }),
  createDefaultTool({
    id: 'seed-rera',
    title: 'RERA',
    description: 'Official Real Estate Regulatory Agency page for regulations, service access, and public guidance.',
    category: 'DLD / RERA',
    url: 'https://dubailand.gov.ae/en/rera/',
    iconName: 'RERA',
    isFeatured: true,
    sortOrder: 20
  }),
  createDefaultTool({
    id: 'seed-trakheesi',
    title: 'Trakheesi',
    description: 'Official Trakheesi access point for permit-related real estate advertising and brokerage workflows.',
    category: 'Trakheesi',
    url: 'https://trakheesi.dubailand.gov.ae/Account/LoginRedirectUrl.aspx',
    iconName: 'TR',
    isFeatured: true,
    sortOrder: 30
  }),
  createDefaultTool({
    id: 'seed-ejari',
    title: 'Ejari',
    description: 'Official DLD Ejari registration and renewal service guidance for rental contract workflows.',
    category: 'Ejari',
    url: 'https://dubailand.gov.ae/en/eservices/register-renew-ejari-contract/',
    iconName: 'EJ',
    isFeatured: true,
    sortOrder: 40
  }),
  createDefaultTool({
    id: 'seed-dubai-rest',
    title: 'Dubai REST',
    description: 'Official Dubai REST service page for real estate transactions, lease services, and smart access.',
    category: 'DLD / RERA',
    url: 'https://dubailand.gov.ae/eservices/dubai-rest/',
    iconName: 'REST',
    isFeatured: true,
    sortOrder: 50
  }),
  createDefaultTool({
    id: 'seed-dewa',
    title: 'DEWA',
    description: 'Dubai Electricity and Water Authority official portal for utility services and account access.',
    category: 'Utilities',
    url: 'https://www.dewa.gov.ae/en/',
    iconName: 'DEWA',
    sortOrder: 60
  }),
  createDefaultTool({
    id: 'seed-empower',
    title: 'Empower',
    description: 'Official Empower district cooling portal for Dubai customer service and account information.',
    category: 'Utilities',
    url: 'https://www.empower.ae/',
    iconName: 'EMP',
    sortOrder: 70
  }),
  createDefaultTool({
    id: 'seed-emicool',
    title: 'Emicool',
    description: 'Official Emicool district cooling website for customer service and utility support.',
    category: 'Utilities',
    url: 'https://www.emicool.com/',
    iconName: 'EMI',
    sortOrder: 80
  }),
  createDefaultTool({
    id: 'seed-etisalat',
    title: 'Etisalat',
    description: 'Official e& UAE portal for telecom services, home internet, and account management.',
    category: 'Utilities',
    url: 'https://www.etisalat.ae/en/',
    iconName: 'E&',
    sortOrder: 90
  }),
  createDefaultTool({
    id: 'seed-du',
    title: 'Du',
    description: 'Official du portal for telecom plans, broadband, and mobile services in the UAE.',
    category: 'Utilities',
    url: 'https://www.du.ae/',
    iconName: 'du',
    sortOrder: 100
  }),
  createDefaultTool({
    id: 'seed-property-finder',
    title: 'Property Finder',
    description: 'Property portal for listing discovery, market research, and real estate lead sourcing.',
    category: 'Property Portals',
    url: 'https://www.propertyfinder.ae/en/',
    iconName: 'PF',
    isFeatured: true,
    sortOrder: 110
  }),
  createDefaultTool({
    id: 'seed-bayut',
    title: 'Bayut',
    description: 'Property portal for market discovery, listing visibility, and UAE property browsing.',
    category: 'Property Portals',
    url: 'https://www.bayut.com/',
    iconName: 'BY',
    sortOrder: 120
  }),
  createDefaultTool({
    id: 'seed-dubizzle',
    title: 'Dubizzle',
    description: 'Marketplace portal used widely in the UAE for property search and listing discovery.',
    category: 'Property Portals',
    url: 'https://dubai.dubizzle.com/',
    iconName: 'DZ',
    sortOrder: 130
  }),
  createDefaultTool({
    id: 'seed-a2a-guide',
    title: 'A2A Agreement Guide',
    description: 'Editable placeholder link for broker-to-broker agreement guidance and internal reference.',
    category: 'Forms & Agreements',
    url: 'https://example.com/broker-toolkit/a2a-agreement-guide',
    iconName: 'A2A',
    sortOrder: 140
  }),
  createDefaultTool({
    id: 'seed-form-a',
    title: 'Form A Guide',
    description: 'Editable placeholder link for Form A guidance until a preferred reference URL is confirmed.',
    category: 'Forms & Agreements',
    url: 'https://example.com/broker-toolkit/form-a-guide',
    iconName: 'A',
    sortOrder: 150
  }),
  createDefaultTool({
    id: 'seed-form-b',
    title: 'Form B Guide',
    description: 'Editable placeholder link for Form B guidance until a preferred reference URL is confirmed.',
    category: 'Forms & Agreements',
    url: 'https://example.com/broker-toolkit/form-b-guide',
    iconName: 'B',
    sortOrder: 160
  }),
  createDefaultTool({
    id: 'seed-form-f',
    title: 'Form F Guide',
    description: 'Editable placeholder link for Form F guidance until a preferred reference URL is confirmed.',
    category: 'Forms & Agreements',
    url: 'https://example.com/broker-toolkit/form-f-guide',
    iconName: 'F',
    sortOrder: 170
  }),
  createDefaultTool({
    id: 'seed-form-i',
    title: 'Form I Guide',
    description: 'Editable placeholder link for Form I guidance until a preferred reference URL is confirmed.',
    category: 'Forms & Agreements',
    url: 'https://example.com/broker-toolkit/form-i-guide',
    iconName: 'I',
    sortOrder: 180
  }),
  createDefaultTool({
    id: 'seed-roi-calc',
    title: 'ROI Calculator',
    description: 'Editable placeholder link for ROI calculation and investment return planning.',
    category: 'Calculators',
    url: 'https://example.com/broker-toolkit/roi-calculator',
    iconName: 'ROI',
    sortOrder: 190
  }),
  createDefaultTool({
    id: 'seed-mortgage-calc',
    title: 'Mortgage Calculator',
    description: 'Editable placeholder link for mortgage estimate workflows and financing planning.',
    category: 'Calculators',
    url: 'https://example.com/broker-toolkit/mortgage-calculator',
    iconName: 'MC',
    sortOrder: 200
  }),
  createDefaultTool({
    id: 'seed-service-charge',
    title: 'Service Charge Guide',
    description: 'Official DLD service charge index service page for jointly owned property fee guidance.',
    category: 'Calculators',
    url: 'https://dubailand.gov.ae/en/eservices/service-charge-index-overview/',
    iconName: 'SCI',
    sortOrder: 210
  })
]);

export function normalizeToolkitToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeToolkitText(value, maxLength = 180) {
  return normalizeText(value).slice(0, maxLength);
}

export function sanitizeToolkitDescription(value, maxLength = 420) {
  return sanitizeToolkitText(value, maxLength);
}

export function normalizeToolkitCategory(value, fallback = 'Company / Broker Tools') {
  const token = normalizeToolkitToken(value);
  return TOOLKIT_CATEGORY_TOKENS.get(token) || fallback;
}

export function isValidToolkitUrl(value) {
  const rawValue = sanitizeToolkitText(value, 2000);
  if (!rawValue) return false;
  try {
    const parsed = new URL(rawValue);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (error) {
    return false;
  }
}

export function normalizeToolkitUrl(value) {
  const rawValue = sanitizeToolkitText(value, 2000);
  if (!rawValue) return '';
  try {
    const parsed = new URL(rawValue);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString();
  } catch (error) {
    return '';
  }
}

export function parseToolkitToolRow(row = {}) {
  return {
    id: sanitizeToolkitText(row.id, 120),
    title: sanitizeToolkitText(row.title, 180),
    description: sanitizeToolkitDescription(row.description, 420),
    category: normalizeToolkitCategory(row.category),
    url: normalizeToolkitUrl(row.url),
    logoUrl: normalizeToolkitUrl(row.logo_url || row.logoUrl),
    iconName: sanitizeToolkitText(row.icon_name || row.iconName, 40),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    isFeatured: Boolean(row.is_featured ?? row.isFeatured),
    sortOrder: Number.isFinite(Number(row.sort_order ?? row.sortOrder)) ? Number(row.sort_order ?? row.sortOrder) : 0,
    createdAt: sanitizeToolkitText(row.created_at || row.createdAt, 120),
    updatedAt: sanitizeToolkitText(row.updated_at || row.updatedAt, 120)
  };
}

export function getDefaultToolkitRows() {
  return DEFAULT_TOOLKIT_TOOLS.map(item => ({ ...item }));
}

export function mergeToolkitRows(primaryRows = [], fallbackRows = []) {
  const merged = [];
  const seen = new Set();
  for (const row of [...(Array.isArray(primaryRows) ? primaryRows : []), ...(Array.isArray(fallbackRows) ? fallbackRows : [])]) {
    const parsed = parseToolkitToolRow(row);
    const key = normalizeToolkitToken(parsed.title || parsed.id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(parsed);
  }
  return merged.sort((left, right) => {
    if ((left.sortOrder || 0) !== (right.sortOrder || 0)) {
      return (left.sortOrder || 0) - (right.sortOrder || 0);
    }
    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

export function sanitizeToolkitToolInput(input = {}) {
  const title = sanitizeToolkitText(input.title, 180);
  const description = sanitizeToolkitDescription(input.description, 420);
  const category = normalizeToolkitCategory(input.category);
  const url = normalizeToolkitUrl(input.url);
  const logoUrl = normalizeToolkitUrl(input.logoUrl || input.logo_url);
  const iconName = sanitizeToolkitText(input.iconName || input.icon_name, 40);
  const sortOrderRaw = Number(input.sortOrder ?? input.sort_order);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.max(-9999, Math.min(9999, Math.round(sortOrderRaw))) : 0;
  return {
    title,
    description,
    category,
    url,
    logo_url: logoUrl || null,
    icon_name: iconName || null,
    is_active: input.isActive !== undefined ? Boolean(input.isActive) : Boolean(input.is_active ?? true),
    is_featured: input.isFeatured !== undefined ? Boolean(input.isFeatured) : Boolean(input.is_featured),
    sort_order: sortOrder
  };
}

export function buildToolkitAnalytics({
  tools = [],
  favorites = [],
  clicks = []
}) {
  const favoriteCounts = new Map();
  const clickCounts = new Map();
  for (const favorite of Array.isArray(favorites) ? favorites : []) {
    const toolId = sanitizeToolkitText(favorite.tool_id || favorite.toolId, 120);
    if (!toolId) continue;
    favoriteCounts.set(toolId, (favoriteCounts.get(toolId) || 0) + 1);
  }
  for (const click of Array.isArray(clicks) ? clicks : []) {
    const toolId = sanitizeToolkitText(click.tool_id || click.toolId, 120);
    if (!toolId) continue;
    clickCounts.set(toolId, (clickCounts.get(toolId) || 0) + 1);
  }

  const toolRows = (Array.isArray(tools) ? tools : []).map(tool => {
    const parsed = parseToolkitToolRow(tool);
    const clickCount = clickCounts.get(parsed.id) || 0;
    const favoriteCount = favoriteCounts.get(parsed.id) || 0;
    return {
      ...parsed,
      clickCount,
      favoriteCount
    };
  });

  const mostUsedTools = [...toolRows]
    .sort((left, right) => {
      if ((right.clickCount || 0) !== (left.clickCount || 0)) {
        return (right.clickCount || 0) - (left.clickCount || 0);
      }
      return String(left.title || '').localeCompare(String(right.title || ''));
    })
    .slice(0, 5);

  return {
    totalTools: toolRows.length,
    activeTools: toolRows.filter(item => item.isActive).length,
    totalClicks: Array.isArray(clicks) ? clicks.length : 0,
    mostUsedTools,
    tools: toolRows
  };
}
