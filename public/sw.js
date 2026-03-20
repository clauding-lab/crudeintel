// CrudeIntel Service Worker — enables PWA install + offline shell caching
const CACHE_NAME = 'crudeintel-v1'

// Cache the app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      '/',
      '/manifest.json',
      '/favicon.svg',
      '/icon-192.png',
      '/icon-512.png',
    ]))
  )
  self.skipWaiting()
})

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first strategy: try network, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Supabase API calls
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.hostname.includes('supabase')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for same-origin requests
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
