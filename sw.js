// Service Worker para AGUATERO
// Cache con network-first: intenta red, si no hay internet usa caché.

const CACHE_NOMBRE = 'aguatero-cache-v2';
const ARCHIVOS_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(evento){
  evento.waitUntil(
    caches.open(CACHE_NOMBRE).then(function(cache){
      return cache.addAll(ARCHIVOS_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(evento){
  evento.waitUntil(
    caches.keys().then(function(nombres){
      return Promise.all(
        nombres.filter(function(nombre){ return nombre !== CACHE_NOMBRE; })
               .map(function(nombre){ return caches.delete(nombre); })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: intenta la red primero (para traer datos frescos si hay internet),
// si falla (sin internet), sirve lo que haya en caché.
self.addEventListener('fetch', function(evento){
  evento.respondWith(
    fetch(evento.request)
      .then(function(respuesta){
        const copia = respuesta.clone();
        caches.open(CACHE_NOMBRE).then(function(cache){
          cache.put(evento.request, copia);
        });
        return respuesta;
      })
      .catch(function(){
        return caches.match(evento.request);
      })
  );
});
