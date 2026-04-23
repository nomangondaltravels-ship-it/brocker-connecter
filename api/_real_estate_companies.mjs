import { normalizeText } from './_broker-platform.mjs';

export const CURATED_REAL_ESTATE_COMPANIES = Object.freeze([
  'Xsite Real Estate',
  'Emaar Properties',
  'DAMAC Properties',
  'Nakheel',
  'Sobha Realty',
  'Azizi Developments',
  'Binghatti Developers',
  'Ellington Properties',
  'Danube Properties',
  'MAG Property Development',
  'Deyaar',
  'Meraas',
  'Dubai Properties',
  'Tiger Group',
  'Select Group',
  'Omniyat',
  'Imtiaz Developments',
  'Reportage Properties',
  'Samana Developers',
  'Nshama',
  'Arada',
  'Union Properties',
  'Wasl Properties',
  'Al Habtoor Group',
  'Allsopp & Allsopp',
  'Betterhomes',
  'Driven Properties',
  'fam Properties',
  'haus & haus',
  'Metropolitan Premium Properties',
  'AX Capital',
  'LuxuryProperty.com',
  'Espace Real Estate',
  'D&B Properties',
  'White & Co Real Estate',
  'Coldwell Banker UAE',
  'Engel & Volkers Dubai',
  'Provident Estate',
  'Seven Century Real Estate',
  'Key One Realty',
  'Hamptons International',
  'Asteco Property Management',
  'Chestertons MENA',
  'Cluttons Middle East',
  'BlackBrick Property',
  'Prime Capital Real Estate',
  'Springfield Real Estate',
  'Zooma Properties',
  'Rocky Real Estate',
  'A1 Properties',
  'Harbor Real Estate',
  'Roots Land Real Estate',
  'Aeon & Trisl',
  'Vibgyor Real Estate',
  'Casa Nostra Real Estate',
  'Prestige Luxury Real Estate',
  'Paragon Properties',
  'Powerhouse Real Estate',
  'Exclusive Links Real Estate',
  'Gold Mark Real Estate',
  'Texture Properties',
  'Unique Properties',
  'Sky View Real Estate',
  'Capri Realty',
  'Homes 4 Life Real Estate',
  'Binayah Real Estate',
  'Penthouse.ae',
  'Square Yards UAE',
  'Raine & Horne UAE',
  'Bluechip Real Estate',
  'Fidu Properties',
  'Indus Real Estate',
  'Savills Middle East',
  'Union Square House',
  'The Urban Nest',
  'McCone Properties',
  'Driven Forbes Global Properties',
  'Stone House Real Estate',
  'Aqua Properties',
  'Range International Property Investments',
  'La Capitale Real Estate',
  'CRC Property',
  'MNA Properties',
  'Better Livings Real Estate',
  'Iconic Realty',
  'Novel Homes Properties',
  'Hive Network Real Estate',
  'XO Property',
  'Anchors Real Estate',
  'Levante Real Estate',
  'Premier Estates',
  'Morgan\'s International Realty',
  'Banke International Properties',
  'WaterWorld Real Estate',
  'RealCO Capital Real Estate',
  'Patriot Real Estate',
  'Fortune 4 Real Estate',
  'Pangea Properties',
  'Allegiance Real Estate',
  'Bluebells Luxury Real Estate',
  'Keymax Real Estate',
  'Embayt Real Estate',
  'Billionaire Homes Real Estate',
  'Royal Link Properties',
  'Dacha Real Estate',
  'Top Apartments Real Estate'
]);

export function normalizeCompanyName(value) {
  return normalizeText(value)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getCuratedApprovedCompanyRows() {
  return CURATED_REAL_ESTATE_COMPANIES.map((name, index) => ({
    id: `curated-${index + 1}`,
    name,
    status: 'approved'
  }));
}

export function sortCompanyRows(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) =>
    String(left?.name || '').localeCompare(String(right?.name || ''), 'en', { sensitivity: 'base' })
  );
}

export function mergeCompanyRows(primaryRows = [], fallbackRows = []) {
  const merged = [];
  const seen = new Set();
  [...(Array.isArray(primaryRows) ? primaryRows : []), ...(Array.isArray(fallbackRows) ? fallbackRows : [])].forEach(row => {
    const key = normalizeCompanyName(row?.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  });
  return sortCompanyRows(merged);
}

export function findApprovedCompanyName(inputValue, approvedRows = []) {
  const normalized = normalizeCompanyName(inputValue);
  if (!normalized) return '';
  const match = (Array.isArray(approvedRows) ? approvedRows : []).find(row => normalizeCompanyName(row?.name) === normalized);
  return normalizeText(match?.name || '');
}

export function parseCompanyRow(row = {}) {
  return {
    ...row,
    id: normalizeText(row.id),
    name: normalizeText(row.name),
    status: normalizeText(row.status || 'approved') || 'approved',
    created_at: normalizeText(row.created_at || row.createdAt),
    updated_at: normalizeText(row.updated_at || row.updatedAt),
    reviewed_at: normalizeText(row.reviewed_at || row.reviewedAt),
    reviewed_by: normalizeText(row.reviewed_by || row.reviewedBy),
    submitted_by_user_id: normalizeText(row.submitted_by_user_id || row.submittedByUserId),
    source: normalizeText(row.source || 'registration_form') || 'registration_form'
  };
}
