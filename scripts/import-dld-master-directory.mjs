import fs from 'node:fs';
import readline from 'node:readline';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const APPLY = process.argv.includes('--apply');

const AREAS_CSV = 'data/dld_lkp_areas_gslb.csv';
const BUILDINGS_CSV = 'data/dld_buildings_gslb.csv';

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map(value => value === 'null' ? '' : normalizeText(value));
}

async function readCsv(filePath, onRow) {
  const stream = fs.createReadStream(filePath);
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers = null;
  let count = 0;
  for await (const line of reader) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    if (!headers) {
      headers = values;
      continue;
    }
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    count += 1;
    await onRow(row, count);
  }
  return count;
}

function isMeaningfulBuildingNumber(value) {
  const name = normalizeText(value);
  if (name.length < 3) return false;
  if (/^\d+[\w/-]*$/i.test(name)) return false;
  if (/^(plot|land|parcel|unit|room|shop|office|warehouse)\b/i.test(name)) return false;
  if (/\b(flat|unit|room|shop|office|warehouse)\b/i.test(name)) return false;
  if (/\bvilla\s*\d/i.test(name)) return false;
  if (!/[a-z]/i.test(name)) return false;
  return /\b(tower|towers|residence|residences|building|heights|point|bay|gate|views|view|park|plaza|court|house|lofts|terrace|terraces|marina|burj|centre|center|mall|hotel|resort|villas|mansions|estate|community|gardens|heaven|avenue|square|place|creek|harbour|harbor|beach|canal|oasis|heights|gateway|district|city|walk|hills|ranch|village|quarters|complex|project)\b/i.test(name);
}

function addLocation(map, name, sourceOrder = 0) {
  const clean = normalizeText(name);
  if (!clean || clean.length < 2) return;
  const key = normalizeKey(clean);
  if (!map.has(key)) {
    map.set(key, {
      name: clean,
      emirate: 'Dubai',
      city: 'Dubai',
      country: 'UAE',
      aliases: [],
      sort_order: sourceOrder,
      is_active: true
    });
  }
}

function addBuilding(map, name, locationName = '', sourceOrder = 0) {
  const clean = normalizeText(name);
  const location = normalizeText(locationName);
  if (!clean || clean.length < 2) return;
  if (/^(n\/a|na|null|none|-|\.)$/i.test(clean)) return;
  const key = `${normalizeKey(clean)}|${normalizeKey(location)}`;
  if (!map.has(key)) {
    map.set(key, {
      name: clean,
      location_name: location || null,
      emirate: 'Dubai',
      developer_name: null,
      aliases: [],
      sort_order: sourceOrder,
      is_active: true
    });
  }
}

async function supabaseGet(table) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to read ${table}: ${response.status} ${await response.text()}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function supabaseInsert(table, rows) {
  if (!rows.length) return;
  const chunkSize = 500;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(chunk)
    });
    if (!response.ok) {
      throw new Error(`Failed to insert ${table}: ${response.status} ${await response.text()}`);
    }
  }
}

async function main() {
  const locations = new Map();
  const buildings = new Map();

  const areaRows = await readCsv(AREAS_CSV, (row, count) => {
    addLocation(locations, row.name_en, count);
  });

  const buildingRows = await readCsv(BUILDINGS_CSV, (row, count) => {
    const areaName = normalizeText(row.area_name_en);
    addLocation(locations, areaName, 1000 + count);
    addBuilding(buildings, row.project_name_en, areaName, count);
    addBuilding(buildings, row.master_project_en, areaName, count);
    if (isMeaningfulBuildingNumber(row.building_number)) {
      addBuilding(buildings, row.building_number, areaName, count);
    }
  });

  const currentLocations = await supabaseGet('master_locations');
  const currentBuildings = await supabaseGet('master_building_projects');
  const currentLocationKeys = new Set(currentLocations.map(row => normalizeKey(row.name)));
  const currentBuildingKeys = new Set(currentBuildings.map(row => `${normalizeKey(row.name)}|${normalizeKey(row.location_name)}`));

  const missingLocations = [...locations.values()]
    .filter(row => !currentLocationKeys.has(normalizeKey(row.name)))
    .sort((left, right) => left.name.localeCompare(right.name));
  const missingBuildings = [...buildings.values()]
    .filter(row => !currentBuildingKeys.has(`${normalizeKey(row.name)}|${normalizeKey(row.location_name)}`))
    .sort((left, right) => (left.location_name || '').localeCompare(right.location_name || '') || left.name.localeCompare(right.name));

  const summary = {
    apply: APPLY,
    sourceRows: { areas: areaRows, buildings: buildingRows },
    extracted: { locations: locations.size, buildingProjects: buildings.size },
    existing: { locations: currentLocations.length, buildingProjects: currentBuildings.length },
    missing: { locations: missingLocations.length, buildingProjects: missingBuildings.length },
    sampleLocations: missingLocations.slice(0, 10).map(row => row.name),
    sampleBuildingProjects: missingBuildings.slice(0, 10).map(row => `${row.name}${row.location_name ? ` (${row.location_name})` : ''}`)
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) return;
  await supabaseInsert('master_locations', missingLocations);
  await supabaseInsert('master_building_projects', missingBuildings);
  console.log(JSON.stringify({ inserted: summary.missing }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
