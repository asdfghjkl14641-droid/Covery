const CACHE_VERSION = 'covery-v1'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const DATA_CACHE = `${CACHE_VERSION}-data`
const IMG_CACHE = `${CACHE_VERSION}-img`

// App shell files to precache
const SHELL_FILES = [
  '/',
  '/manifest.json',
]

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_FILES))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== SHELL_CACHE && key !== DATA_CACHE && key !== IMG_CACHE)
          .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: route-based caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Network only: YouTube IFrame API, external APIs, non-GET
  if (event.request.method !== 'GET') return
  if (url.hostname.includes('youtube.com') || url.hostname.includes('googleapis.com')) return
  if (url.hostname.includes('spotify.com') || url.hostname.includes('deezer.com')) return

  // YouTube thumbnails: Cache first, network fallback
  if (url.hostname === 'img.youtube.com' || url.hostname === 'i.ytimg.com') {
    event.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          }).catch(() => cached)
        })
      )
    )
    return
  }

  // JSON data files: Cache first
  if (url.pathname.endsWith('.json') && url.origin === self.location.origin) {
    event.respondWith(
      caches.open(DATA_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          }).catch(() => cached)
          return cached || fetchPromise
        })
      )
    )
    return
  }

  // App shell (HTML, CSS, JS): Cache first, network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          }).catch(() => cached)
          return cached || fetchPromise
        })
      )
    )
    return
  }
})
