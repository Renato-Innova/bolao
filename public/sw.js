const CACHE = 'bolao-v2'

self.addEventListener('install', e => {
  // Only pre-cache the manifest and icons — never authenticated routes
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Only cache static assets (images, icons, fonts) — never HTML/API
  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/_next/')) return

  // Only cache image/icon files
  const isStatic = /\.(png|svg|jpg|jpeg|webp|woff2|ico)$/.test(url.pathname)
  if (!isStatic) return

  e.respondWith(
    caches.match(request).then(cached => cached ?? fetch(request).then(res => {
      caches.open(CACHE).then(c => c.put(request, res.clone()))
      return res
    }))
  )
})
