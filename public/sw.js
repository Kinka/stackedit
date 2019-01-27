var cacheName = 'stack-editor-4'
var filesToCache = [
    '/main.js'
].map(function(file) {
    return '/res-min' + file
})

self.addEventListener('install', function(e) {
    console.log('install...')
    e.waitUntil(
        caches.open(cacheName).then(function(cache) {
            self.cache = cache
            console.log('cache')

            return cache.addAll(filesToCache)
        })
    )
})

self.addEventListener('activate', function(e) {
    console.log('activate')

    e.waitUntil(
        caches.keys().then(function(keyList) {
            return Promise.all(keyList.map(function(key) {
                if (key !== cacheName) {
                    console.log('removing old cache', key)
                    return caches.delete(key)
                }
            }))
        })
    )

    return self.clients.claim()
})

self.addEventListener('fetch', function(e) {
    if (e.request.url.indexOf('/res/') > -1) return

    e.respondWith(
        caches.match(e.request).then(function(response) {
            return response || fetch(e.request).then(res => {
                var fileToCache = e.request.url.replace(location.origin, '')
                if (fileToCache.match(/^\/(res|res\-min)/)) {
                    console.log('to cache', fileToCache)
                    if (self.cache) self.cache.add(fileToCache)
                }
                
                return res
            })
        })
    )
})
