const fs = require('fs');
const path = require('path');

const root = __dirname;
const photosDir = path.join(root, 'barrier_free_photos_1778423209775');
const csvPath = path.join(root, 'barrier_free_data_1779802242012.csv');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function findB1ImageName(value) {
  if (!value) return null;
  try {
    const data = JSON.parse(value);
    if (Array.isArray(data)) {
      for (const group of data) {
        const floor = group.floor || group.name || group.label || group.floorName;
        if (floor === 'B1') {
          const photos = group.photos || group.images || group.files || [];
          const first = photos[0];
          if (typeof first === 'string') return first;
          if (first && typeof first === 'object') {
            return first.name || first.fileName || first.filename || first.path || null;
          }
        }
      }
    } else if (data && typeof data === 'object') {
      const b1 = data.B1 || data.b1;
      if (b1) {
        const photos = Array.isArray(b1) ? b1 : b1.photos || b1.images || b1.files || [];
        const first = photos[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object') {
          return first.name || first.fileName || first.filename || first.path || null;
        }
      }
    }
  } catch (_) {
    // fall through
  }
  const quoted = value.match(/"name"\s*:\s*"([^"]+)"/);
  if (quoted) return quoted[1];
  return null;
}

// 1. data_* folders
const entries = fs.readdirSync(photosDir, { withFileTypes: true });
const dataFolders = entries
  .filter((e) => e.isDirectory() && /^data_\d+$/.test(e.name))
  .map((e) => e.name)
  .sort((a, b) => parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10));
const nums = dataFolders.map((f) => parseInt(f.split('_')[1], 10));
const maxNum = nums.length ? Math.max(...nums) : 0;

console.log('=== 1. data_* folders ===');
console.log('Count:', dataFolders.length);
console.log('Max number:', maxNum);
console.log('Folder names:', dataFolders.join(', '));

// 2. CSV buildings
const csvText = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
const header = parseCsvLine(lines[0]);
const buildingIdx = header.findIndex(
  (h) => /building/i.test(h) || h.includes('건물') || h === 'name' || h === 'buildingName'
);
const buildingCol = buildingIdx >= 0 ? buildingIdx : 1;
const buildings = lines.slice(1).map((l) => parseCsvLine(l)[buildingCol]).filter(Boolean);

console.log('\n=== 2. CSV buildings ===');
console.log('Header first line:', lines[0]);
console.log('Building column:', buildingCol, header[buildingCol] || '(fallback col 1)');
console.log('Building count:', buildings.length);
console.log('First building name:', buildings[0] || '(none)');

// 3. data_1/B1 one file
const b1Dir = path.join(photosDir, 'data_1', 'B1');
const b1Files = fs.existsSync(b1Dir)
  ? fs.readdirSync(b1Dir).filter((f) => !f.startsWith('.'))
  : [];
const b1Sample = b1Files[0] || '(none)';

console.log('\n=== 3. data_1/B1 sample file ===');
console.log('One file name:', b1Sample);

// 4. Match CSV row 0 floorPhotoGroupsJson B1 image
const row0 = parseCsvLine(lines[1]);
const jsonIdx = header.findIndex((h) => h === 'floorPhotoGroupsJson');
const b1FromCsv = jsonIdx >= 0 ? findB1ImageName(row0[jsonIdx]) : null;

console.log('\n=== 4. CSV row 0 B1 image match ===');
console.log('floorPhotoGroupsJson column:', jsonIdx >= 0 ? header[jsonIdx] : '(not found)');
console.log('B1 image name from CSV row 0:', b1FromCsv || '(not found)');
console.log('data_1/B1 file name:', b1Sample);
console.log('Exact match:', b1FromCsv === b1Sample);
console.log('Exists in B1 folder:', b1FromCsv ? b1Files.includes(b1FromCsv) : false);

const outPath = path.join(root, 'check_result.txt');
const lines = [];
const log = (...args) => {
  const line = args.join(' ');
  lines.push(line);
  console.log(line);
};
// re-log summary to file (stdout may not be captured in some shells)
lines.length = 0;
lines.push('=== 1. data_* folders ===');
lines.push(`Count: ${dataFolders.length}`);
lines.push(`Max number: ${maxNum}`);
lines.push(`Folder names: ${dataFolders.join(', ')}`);
lines.push('');
lines.push('=== 2. CSV buildings ===');
lines.push(`Building column: ${buildingCol} (${header[buildingCol] || 'fallback'})`);
lines.push(`Building count: ${buildings.length}`);
lines.push(`First building name: ${buildings[0] || '(none)'}`);
lines.push('');
lines.push('=== 3. data_1/B1 sample file ===');
lines.push(`One file name: ${b1Sample}`);
lines.push('');
lines.push('=== 4. CSV row 0 B1 image match ===');
lines.push(`B1 image name from CSV row 0: ${b1FromCsv || '(not found)'}`);
lines.push(`data_1/B1 file name: ${b1Sample}`);
lines.push(`Exact match: ${b1FromCsv === b1Sample}`);
lines.push(`Exists in B1 folder: ${b1FromCsv ? b1Files.includes(b1FromCsv) : false}`);
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
