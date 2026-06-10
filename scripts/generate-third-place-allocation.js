// ============================================================
// Generate FIFA World Cup 2026 Annex C third-place allocation data.
// Source: source-data/third-place-table.tsv, extracted from the rendered
// table that mirrors FIFA Regulations Annex C.
//
// Outputs:
//   third-place-allocation.js        browser global used by app.js
//   lib/third-place-allocation.mjs   ESM used by server-side bracket rendering
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_TSV = path.join(ROOT, 'source-data', 'third-place-table.tsv');
const SOURCE_HTML = path.join(ROOT, 'source-data', 'third-place-table.html');
const OUT_BROWSER = path.join(ROOT, 'third-place-allocation.js');
const OUT_ESM = path.join(ROOT, 'lib', 'third-place-allocation.mjs');

const GROUPS = 'ABCDEFGHIJKL'.split('');
const FIFA_COLUMNS = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'];
const APP_POSITION_ORDER = [2, 5, 7, 8, 9, 10, 13, 15];
const APP_POSITIONS_BY_FIFA_COLUMN = {
  '1A': 7,
  '1B': 13,
  '1D': 9,
  '1E': 2,
  '1G': 10,
  '1I': 5,
  '1K': 15,
  '1L': 8
};

const SLOT_ALLOWED = {
  2:  ['A', 'B', 'C', 'D', 'F'],
  5:  ['C', 'D', 'F', 'G', 'H'],
  7:  ['C', 'E', 'F', 'H', 'I'],
  8:  ['E', 'H', 'I', 'J', 'K'],
  9:  ['B', 'E', 'F', 'I', 'J'],
  10: ['A', 'E', 'H', 'I', 'J'],
  13: ['E', 'F', 'G', 'I', 'J'],
  15: ['D', 'E', 'I', 'J', 'L']
};

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function combinations(items, k, start = 0, prefix = [], out = []) {
  if (prefix.length === k) {
    out.push(prefix.join(''));
    return out;
  }
  for (let i = start; i <= items.length - (k - prefix.length); i++) {
    prefix.push(items[i]);
    combinations(items, k, i + 1, prefix, out);
    prefix.pop();
  }
  return out;
}

function parseTable(html) {
  const rows = {};
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html))) {
    const rowHtml = rowMatch[1];
    const numMatch = rowHtml.match(/<th\b[^>]*scope=["']row["'][^>]*>\s*(\d+)\s*<\/th>/i);
    if (!numMatch) continue;
    const option = Number(numMatch[1]);
    const cells = [];
    const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRe.exec(rowHtml))) cells.push(stripHtml(tdMatch[1]));
    if (cells.length !== 20) throw new Error(`Option ${option}: expected 20 cells, got ${cells.length}`);

    const qualifyingGroups = cells.slice(0, 12).filter(Boolean);
    const key = qualifyingGroups.join('');
    const assignments = cells.slice(12).map(v => v.replace(/^3/, ''));

    if (qualifyingGroups.length !== 8) throw new Error(`Option ${option}: expected 8 groups, got ${key}`);
    if (key !== [...qualifyingGroups].sort().join('')) throw new Error(`Option ${option}: unsorted groups ${key}`);
    if (new Set(qualifyingGroups).size !== 8) throw new Error(`Option ${option}: duplicate group in ${key}`);
    if (assignments.length !== 8 || assignments.some(g => !GROUPS.includes(g))) {
      throw new Error(`Option ${option}: invalid assignments ${assignments.join(',')}`);
    }
    if (new Set(assignments).size !== 8 || assignments.slice().sort().join('') !== key) {
      throw new Error(`Option ${option}: assignments ${assignments.join('')} do not match groups ${key}`);
    }

    const byPosition = {};
    FIFA_COLUMNS.forEach((col, index) => {
      const pos = APP_POSITIONS_BY_FIFA_COLUMN[col];
      const group = assignments[index];
      if (!SLOT_ALLOWED[pos].includes(group)) {
        throw new Error(`Option ${option}: ${col}/pos ${pos} cannot receive group ${group}`);
      }
      byPosition[pos] = group;
    });

    rows[key] = byPosition;
  }
  return rows;
}

function parseTsv(tsv) {
  const rows = {};
  const lines = tsv.trim().split(/\r?\n/);
  const header = lines.shift().split('\t');
  const expectedHeader = ['option', 'groups', ...FIFA_COLUMNS];
  if (header.join('\t') !== expectedHeader.join('\t')) {
    throw new Error(`unexpected TSV header: ${header.join('\t')}`);
  }
  for (const line of lines) {
    if (!line.trim()) continue;
    const [optionRaw, key, ...assignments] = line.split('\t');
    const option = Number(optionRaw);
    if (!option || assignments.length !== 8) throw new Error(`bad TSV row: ${line}`);
    const qualifyingGroups = key.split('');
    const byPosition = {};
    FIFA_COLUMNS.forEach((col, index) => {
      const pos = APP_POSITIONS_BY_FIFA_COLUMN[col];
      const group = assignments[index].replace(/^3/, '');
      if (!SLOT_ALLOWED[pos].includes(group)) {
        throw new Error(`Option ${option}: ${col}/pos ${pos} cannot receive group ${group}`);
      }
      byPosition[pos] = group;
    });
    if (qualifyingGroups.length !== 8 || new Set(qualifyingGroups).size !== 8) {
      throw new Error(`Option ${option}: invalid group key ${key}`);
    }
    if (Object.values(byPosition).sort().join('') !== key) {
      throw new Error(`Option ${option}: assignments do not match groups ${key}`);
    }
    rows[key] = byPosition;
  }
  return rows;
}

function toTsv(rows) {
  const lines = [['option', 'groups', ...FIFA_COLUMNS].join('\t')];
  Object.keys(rows).sort().forEach((key, index) => {
    const row = rows[key];
    const assignments = FIFA_COLUMNS.map(col => `3${row[APP_POSITIONS_BY_FIFA_COLUMN[col]]}`);
    lines.push([String(index + 1), key, ...assignments].join('\t'));
  });
  return `${lines.join('\n')}\n`;
}

function stableJson(value, indent = 0) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const pad = ' '.repeat(indent);
    const innerPad = ' '.repeat(indent + 2);
    const entries = Object.keys(value).sort().map(key => `${innerPad}${JSON.stringify(key)}: ${stableJson(value[key], indent + 2)}`);
    return `{\n${entries.join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value);
}

function assertComplete(rows) {
  const expected = combinations(GROUPS, 8);
  const keys = Object.keys(rows).sort();
  if (keys.length !== 495) throw new Error(`expected 495 rows, got ${keys.length}`);
  const missing = expected.filter(k => !rows[k]);
  const extra = keys.filter(k => !expected.includes(k));
  if (missing.length || extra.length) {
    throw new Error(`combination mismatch missing=${missing.slice(0, 5).join(',')} extra=${extra.slice(0, 5).join(',')}`);
  }
  const row486 = rows.ABCDEFIJ;
  const want486 = { 2:'D', 5:'F', 7:'C', 8:'I', 9:'B', 10:'A', 13:'J', 15:'E' };
  if (JSON.stringify(row486) !== JSON.stringify(want486)) {
    throw new Error(`row 486 mismatch got=${JSON.stringify(row486)}`);
  }
}

let rows;
if (fs.existsSync(SOURCE_TSV)) {
  rows = parseTsv(fs.readFileSync(SOURCE_TSV, 'utf8'));
} else if (fs.existsSync(SOURCE_HTML)) {
  rows = parseTable(fs.readFileSync(SOURCE_HTML, 'utf8'));
  fs.writeFileSync(SOURCE_TSV, toTsv(rows));
} else {
  throw new Error(`Missing source table. Expected ${path.relative(ROOT, SOURCE_TSV)}`);
}
assertComplete(rows);

const sourceLabel = 'source-data/third-place-table.tsv';
const encodedRows = Object.fromEntries(
  Object.keys(rows).sort().map(key => [key, APP_POSITION_ORDER.map(pos => rows[key][pos]).join('')])
);
const tableJson = stableJson(encodedRows);

const browser = `// Generated by scripts/generate-third-place-allocation.js from source-data/third-place-table.tsv.\n` +
`// Source table mirrors FIFA World Cup 2026 Regulations Annex C.\n` +
`(function (global) {\n` +
`  'use strict';\n` +
`  const POSITION_ORDER = Object.freeze(${JSON.stringify(APP_POSITION_ORDER)});\n` +
`  const ROWS = Object.freeze(${tableJson.replace(/\n/g, '\n  ')});\n` +
`  function key(groups) {\n` +
`    return Array.from(new Set(groups || [])).filter(Boolean).sort().join('');\n` +
`  }\n` +
`  function resolveThirdPlaceAssignment(groups) {\n` +
`    const encoded = ROWS[key(groups)];\n` +
`    if (!encoded) return null;\n` +
`    const row = {};\n` +
`    POSITION_ORDER.forEach((pos, index) => { row[pos] = encoded[index]; });\n` +
`    return row;\n` +
`  }\n` +
`  global.FB_THIRD_PLACE_ALLOCATION = Object.freeze({\n` +
`    source: ${JSON.stringify(sourceLabel)},\n` +
`    rowCount: Object.keys(ROWS).length,\n` +
`    rows: ROWS,\n` +
`    key,\n` +
`    resolveThirdPlaceAssignment\n` +
`  });\n` +
`})(typeof window !== 'undefined' ? window : globalThis);\n`;

const esm = `// Generated by scripts/generate-third-place-allocation.js from source-data/third-place-table.tsv.\n` +
`// Source table mirrors FIFA World Cup 2026 Regulations Annex C.\n` +
`export const SP_THIRD_PLACE_ALLOCATION_SOURCE = ${JSON.stringify(sourceLabel)};\n` +
`export const SP_THIRD_PLACE_POSITION_ORDER = Object.freeze(${JSON.stringify(APP_POSITION_ORDER)});\n` +
`export const SP_THIRD_PLACE_ALLOCATION_ROWS = Object.freeze(${tableJson});\n` +
`export function thirdPlaceAllocationKey(groups) {\n` +
`  return Array.from(new Set(groups || [])).filter(Boolean).sort().join('');\n` +
`}\n` +
`export function resolveThirdPlaceAssignment(groups) {\n` +
`  const encoded = SP_THIRD_PLACE_ALLOCATION_ROWS[thirdPlaceAllocationKey(groups)];\n` +
`  if (!encoded) return null;\n` +
`  const row = {};\n` +
`  SP_THIRD_PLACE_POSITION_ORDER.forEach((pos, index) => { row[pos] = encoded[index]; });\n` +
`  return row;\n` +
`}\n`;

fs.writeFileSync(OUT_BROWSER, browser);
fs.writeFileSync(OUT_ESM, esm);

console.log(`Generated ${Object.keys(rows).length} allocation rows`);
console.log(`- ${path.relative(ROOT, OUT_BROWSER)}`);
console.log(`- ${path.relative(ROOT, OUT_ESM)}`);
