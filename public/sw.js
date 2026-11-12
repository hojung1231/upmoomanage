// 공유하기로 받은 텍스트/텍스트파일을 잠시 보관했다가 앱으로 넘겨주는 서비스워커.
// (화면 파일은 캐시하지 않음 → 업데이트는 항상 바로 반영)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'POST' || !url.pathname.endsWith('/share-target')) return

  e.respondWith(
    (async () => {
      const fd = await e.request.formData()
      const files = []
      for (const f of fd.getAll('file')) {
        if (f && typeof f.text === 'function') files.push({ name: f.name, text: await f.text() })
      }
      const data = { title: fd.get('title') || '', text: fd.get('text') || '', files }
      const cache = await caches.open('share')
      await cache.put('shared-data', new Response(JSON.stringify(data)))
      return Response.redirect(new URL('./?share=1', self.registration.scope).href, 303)
    })()
  )
})
