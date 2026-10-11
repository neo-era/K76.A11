const CACHE_VERSION = 'k76-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const TILE_CACHE = `${CACHE_VERSION}-tiles`;
const TILE_LIMIT = 60;
const NET_TIMEOUT = 4000;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon-180.png',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/layers.png',
  'vendor/leaflet/images/layers-2x.png',
  'vendor/leaflet/images/marker-icon.png',
  'vendor/markercluster/leaflet.markercluster.js',
  'vendor/markercluster/MarkerCluster.css',
  'vendor/markercluster/MarkerCluster.Default.css',
  'images/blank.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(res => { clearTimeout(timer); resolve(res); }, err => { clearTimeout(timer); reject(err); });
  });
}

// cacheKey: URL dùng làm khóa lưu (bỏ tham số chống cache như t=...)
async function networkFirst(request, cacheName, cacheKey) {
  const cache = await caches.open(cacheName);
  const key = cacheKey || request;
  try {
    const res = await fetchWithTimeout(request, NET_TIMEOUT);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fetching = fetch(request).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
    return res;
  }).catch(() => hit);
  return hit || fetching;
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') {
    cache.put(request, res.clone());
    if (limit) trim(cacheName, limit);
  }
  return res;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Dữ liệu động: luôn thử mạng trước, offline dùng bản đã lưu
  if (url.hostname === 'docs.google.com') {
    const key = new URL(url);
    key.searchParams.delete('t');
    event.respondWith(networkFirst(request, RUNTIME_CACHE, key.toString()));
    return;
  }
  // GAS: chỉ cache lệnh đọc; lệnh ghi (update, add, delete…) luôn đi thẳng mạng
  if (url.hostname === 'script.google.com') {
    const action = url.searchParams.get('action');
    if (action === 'getGallery' || action === 'getBooks') event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // Tile bản đồ: cache-first có giới hạn
  if (/tile\.openstreetmap\.org$|api\.mapbox\.com$|\.google\.com$/.test(url.hostname) && /\/(tiles?|vt)\b|\.png/.test(url.pathname + url.search)) {
    event.respondWith(cacheFirst(request, TILE_CACHE, TILE_LIMIT).catch(() => Response.error()));
    return;
  }

  if (url.origin === location.origin) {
    // Trang chính: mạng trước để nhận bản mới, offline dùng shell
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, SHELL_CACHE).catch(() => caches.match('index.html')));
      return;
    }
    // Ảnh học viên: stale-while-revalidate
    if (url.pathname.includes('/images/')) {
      event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
      return;
    }
    // Phần còn lại của shell: cache-first
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
    return;
  }

  // Font / thư viện CDN
  if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});
