const CACHE_NAME = 'hungry-villains-shell-v4';
const APP_SHELL = [
    './index.html', './assets/css/style.css', './assets/css/register.css',
    './assets/js/core.js', './assets/js/offline.js', './assets/js/checkout.js',
    './assets/js/management.js', './assets/js/bootstrap.js', './assets/js/products.js',
    './assets/js/navigation.js', './assets/js/catalog-cart.js',
    './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
    './pictures/burgir.webp', './pictures/piza.webp', './pictures/salad.webp',
    './pictures/sushi.webp', './pictures/frinch%20fris.webp', './pictures/ice%20kupi.webp',
    './pictures/fried%20siken.jpg'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('hungry-villains-shell-') && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    const scope = self.registration.scope;
    if (request.method !== 'GET' || !url.href.startsWith(scope)) return;
    const relative = url.href.slice(scope.length);
    if (request.mode === 'navigate' && /^(?:index\.html)?(?:\?|$)/.test(relative)) {
        event.respondWith(caches.match(new URL('./index.html', scope)).then(response => response || fetch(request)));
        return;
    }
    if (!/^(assets|pictures|icons)\//.test(relative) && relative !== 'manifest.json') return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const existing = await cache.match(request);
        if (existing) return existing;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
    })());
});
