#!/usr/bin/env node
/**
 * Regenerates sitemap.xml by scanning the repo for indexable HTML pages.
 * Run after publishing/removing any guide:  node scripts/build-sitemap.js
 *
 * Rules:
 *  - Always includes the home page "/".
 *  - Includes every guides/**.html EXCEPT files starting with "_" and the template.
 *  - Skips any HTML that contains <meta name="robots" content="noindex">.
 *  - With Vercel cleanUrls, the .html extension is dropped from <loc>.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://friendlybet.live';
const GUIDES_DIR = path.join(ROOT, 'guides');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    if (e.isFile() && e.name.endsWith('.html') && !e.name.startsWith('_')) return [full];
    return [];
  });
}

function toLoc(file) {
  let rel = path.relative(ROOT, file).split(path.sep).join('/'); // e.g. guides/he/foo.html
  rel = rel.replace(/\.html$/, '');           // cleanUrls
  rel = rel.replace(/\/index$/, '/');         // guides/index -> guides/
  return `${ORIGIN}/${rel}`;
}

const urls = [{ loc: `${ORIGIN}/`, changefreq: 'weekly', priority: '1.0' }];

for (const file of walk(GUIDES_DIR)) {
  const html = fs.readFileSync(file, 'utf8');
  if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
  const loc = toLoc(file);
  const isHub = /\/guides\/?$/.test(loc);
  urls.push({ loc, changefreq: isHub ? 'daily' : 'monthly', priority: isHub ? '0.8' : '0.7' });
}

// De-dupe + stable sort (home first, then alphabetical).
const seen = new Set();
const unique = urls.filter((u) => (seen.has(u.loc) ? false : seen.add(u.loc)));
unique.sort((a, b) => (a.priority === '1.0' ? -1 : b.priority === '1.0' ? 1 : a.loc.localeCompare(b.loc)));

const today = new Date().toISOString().slice(0, 10);
const body = unique
  .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log(`sitemap.xml written with ${unique.length} URL(s).`);
