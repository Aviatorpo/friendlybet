// Vercel serverless function (Node runtime): renders a user's "Road to Glory"
// share card as a 1200x630 PNG for social link previews (og:image). Fetches
// the user's knockout picks from Supabase and rasterizes via @vercel/og.
//
//   GET /api/og?u=<user_id>&p=<pool_id>&lang=he|en  ->  image/png
//
// Fonts are static WOFFs bundled from lib/fonts (Satori can't parse variable
// fonts); they're shipped with the function via vercel.json `includeFiles`.

import { readFileSync } from 'fs';
import { join } from 'path';
import { ImageResponse } from '@vercel/og';
import { buildCardElement, fetchCardData } from '../lib/og-card.mjs';

const fontDir = join(process.cwd(), 'lib', 'fonts');
const F = (name) => readFileSync(join(fontDir, name));
const FONTS = [
  { name: 'Sora', data: F('Sora-700.woff'), weight: 700, style: 'normal' },
  { name: 'Sora', data: F('Sora-800.woff'), weight: 800, style: 'normal' },
  { name: 'Heebo', data: F('HeeboLatin-400.woff'), weight: 400, style: 'normal' },
  { name: 'Heebo', data: F('HeeboLatin-700.woff'), weight: 700, style: 'normal' },
  { name: 'Heebo', data: F('HeeboLatin-800.woff'), weight: 800, style: 'normal' },
  { name: 'HeeboHe', data: F('HeeboHe-400.woff'), weight: 400, style: 'normal' },
  { name: 'HeeboHe', data: F('HeeboHe-700.woff'), weight: 700, style: 'normal' },
  { name: 'HeeboHe', data: F('HeeboHe-800.woff'), weight: 800, style: 'normal' },
];

// Fetch a QR PNG and return it as a base64 data URI (or null on any failure).
async function qrDataUri(target) {
  try {
    const api = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&qzone=1'
      + '&color=0a0a08&bgcolor=f6f4ee&data=' + encodeURIComponent(target);
    const r = await fetch(api);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const u = url.searchParams.get('u');
    const p = url.searchParams.get('p');
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'he';

    let data = null;
    if (u && p) {
      try { data = await fetchCardData(u, p, lang); } catch (_) { data = null; }
    }
    if (!data) data = { nickname: 'FriendlyBet', pool: '', semis: [], finals: [], champ: null, lang };

    // Pre-fetch the "scan to enter" QR as a base64 data URI so Satori never has
    // to fetch a remote image at render time (a flaky QR host would otherwise
    // throw and break the whole card). On any failure we just drop the QR.
    data.qr = await qrDataUri('https://friendlybet.live/?utm_source=og_qr&utm_medium=share_card');

    const image = new ImageResponse(buildCardElement(data), { width: 1200, height: 630, fonts: FONTS });
    const buf = Buffer.from(await image.arrayBuffer());

    res.setHeader('Content-Type', 'image/png');
    // Cache hard at the edge (picks rarely change once submitted); revalidate in bg.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).json({ error: 'og render failed', detail: String(err && err.message || err) });
  }
}
