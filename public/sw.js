const CACHE = 'bolao-v1'

// Pages to pre-cache on install
const PRECACHE = [
  '/',
  '/dashboard',
  '/palpites',
  '/ranking',
  '/tabela',
  '/instrucoes',
  '/manifest.json',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  // Remove old caches
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Only cache same-origin GET requests — skip API calls and Supabase
  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return

  e.respondWith(
    caches.match(request).then(cached => {
      // Network-first for navigation, cache-first for assets
      if (request.mode === 'navigate') {
        return fetch(request)
          .then(res => { caches.open(CACHE).then(c => c.put(request, res.clone())); return res })
          .catch(() => cached ?? caches.match('/dashboard'))
      }
      return cached ?? fetch(request).then(res => {
        caches.open(CACHE).then(c => c.put(request, res.clone()))
        return res
      })
    })
  )
})
