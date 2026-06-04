// Serves the /share page with a PER-USER og:image injected, so a raw link
// paste (WhatsApp/Facebook/X) previews that user's "Road to Glory" card.
// Humans still get the same share.html body (its JS renders the full page);
// crawlers read the patched <meta og:image> pointing at /api/og.
//
// Routed from /share via vercel.json. Reads the static share.html from disk
// (no HTTP self-fetch, so cleanUrls' /share.html->/share redirect can't loop).

import { readFileSync } from 'fs';
import { join } from 'path';

const ORIGIN = 'https://friendlybet.live';

function loadTemplate() {
  // share-page.html (not share.html) so it has no clean-URL collision with the
  // /share route — otherwise the static file wins over this function's rewrite.
  const candidates = [
    join(process.cwd(), 'share-page.html'),
    new URL('../share-page.html', import.meta.url).pathname,
    join(process.cwd(), '..', 'share-page.html'),
  ];
  for (const c of candidates) {
    try { const html = readFileSync(c, 'utf8'); if (html) return html; } catch (_) {}
  }
  return null;
}
const TEMPLATE = loadTemplate();

export default function handler(req, res) {
  const url = new URL(req.url, ORIGIN);

  // If the template couldn't be read at cold-start (shouldn't happen with
  // includeFiles), serve a tiny page: crawlers get the generic brand OG,
  // humans are redirected home. Never point at /share.html — cleanUrls would
  // bounce it back here and loop.
  if (!TEMPLATE) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!DOCTYPE html><html lang="he"><head><meta charset="UTF-8">`
      + `<meta name="robots" content="noindex,follow">`
      + `<meta property="og:image" content="${ORIGIN}/og-image-he.png">`
      + `<meta property="og:title" content="FriendlyBet — World Cup 2026 predictions">`
      + `<title>FriendlyBet</title><script>location.replace('/')</script></head><body></body></html>`);
    return;
  }
  const u = url.searchParams.get('u');
  const p = url.searchParams.get('p');
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'he';

  let html = TEMPLATE;
  if (u && p) {
    const ogImg = `${ORIGIN}/api/og?u=${encodeURIComponent(u)}&p=${encodeURIComponent(p)}&lang=${lang}`;
    html = html
      .replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${ogImg}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${ogImg}$2`);
    // share.html has no explicit twitter:image; twitter falls back to og:image.
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(html);
}
