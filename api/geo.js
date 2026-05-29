// Tiny Vercel serverless function: returns the requesting visitor's 2-letter
// country code (ISO 3166-1 alpha-2) from the platform-provided edge header.
// Used as a server-side fallback when the client-side ipapi.co lookup fails
// (ad blocker, DNS filtering, slow network, or rate limit).
//
// Why this exists: client-side geo detection misses ~20–30% of visitors. The
// Vercel header is free, has no rate limit, and is always available because
// it's set by the same CDN serving the page.
//
// Returns: { country: "US" | "IL" | ... } or { country: null } if the header
// is missing (e.g. local dev). Cached briefly per IP at the CDN edge.

export default function handler(req, res) {
  // Vercel sets x-vercel-ip-country (and -region, -city) on every request.
  // It's a 2-letter ISO code or "XX" / undefined when unknown.
  const raw = (req.headers['x-vercel-ip-country'] || '').toString().toUpperCase();
  const country = /^[A-Z]{2}$/.test(raw) && raw !== 'XX' ? raw : null;

  // Cache by client IP for 5 minutes — same visitor on the same device gets a
  // fast 304/hit on revisit; different visitors get fresh lookups.
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ country }));
}
