// ============================================================
// FriendlyBet Service Worker
// ============================================================
// Enables PWA installation and offline support
// Strategy: Cache-first for assets, Network-first for API
// ============================================================

const CACHE_VERSION = 'friendlybet-v2.6.54';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Files to pre-cache (the app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/privacy.html',
  '/styles.css',
  '/landing.css',
  '/app.js',
  '/config.js',
  '/i18n.js',
  '/manifest.json',
  '/favicon.svg',
  '/favicon-96.png',
  '/favicon-48.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512.svg'
];

// External CDN resources we want to cache
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.40.0/tabler-icons.min.css'
];

// ============================================================
// INSTALL - Cache app shell
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching app shell');
        // Use individual adds so one failure doesn't break everything
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err.message);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Install complete - activating immediately');
        return self.skipWaiting();
      })
  );
});

// ============================================================
// ACTIVATE - Clean up old caches
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('friendlybet-') && !name.startsWith(CACHE_VERSION))
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming all clients');
        return self.clients.claim();
      })
  );
});

// ============================================================
// FETCH - Smart caching strategy
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls (always fetch fresh)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Skip football-data.org API
  if (url.hostname.includes('football-data.org')) {
    return;
  }

  // Skip Vercel Analytics — let the browser hit it directly so beacons fire
  if (url.pathname.startsWith('/_vercel/')) {
    return;
  }

  // Pillar 1: CDN data snapshots must always come fresh from the network/edge — never let
  // the SW serve a stale matches/leaderboard JSON from its runtime cache.
  if (url.pathname.startsWith('/public-data/')) {
    return;
  }

  // v2.5.52: our own JS / config / i18n use network-first so a bug-fix
  // deploy reaches the user on the *next* page load instead of two loads
  // later (the previous cache-first kept serving stale code with the
  // updated cache only effective on the load after that). Fallback to
  // cache when offline.
  if (request.destination === 'script' ||
      url.pathname.endsWith('/app.js') ||
      url.pathname.endsWith('/config.js') ||
      url.pathname.endsWith('/i18n.js') ||
      url.pathname.endsWith('/service-worker.js')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Strategy 1: Cache-first for other static assets (CSS, icons, manifest)
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname === asset.replace(/^\//, ''))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy 2: Cache-first for fonts and icons
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('esm.sh')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy 3: Network-first for HTML
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default: try cache, fallback to network
  event.respondWith(cacheFirst(request));
});

// ============================================================
// Caching strategies
// ============================================================

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    // Refresh in background
    fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline + not cached
    if (request.destination === 'document') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    
    // Fallback to index.html for navigation
    if (request.destination === 'document') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    
    throw err;
  }
}

// ============================================================
// Message handling (for cache busting from app)
// ============================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
    );
  }
});

console.log('[SW] Service Worker loaded - v1');
