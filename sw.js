// Service Worker para AGUATERO
// FIX: Cache con network-first + timeout de 3s, solo GET, valida status 200

const CACHE_NOMBRE = 'aguatero-cache-v7';
const ARCHIVOS_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // FIX: Agregar SDK de Supabase al cache para que funcione offline
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

self.addEventListener('install', function(evento){
  evento.waitUntil(
    caches.open(CACHE_NOMBRE).then(function(cache){
      return cache.addAll(ARCHIVOS_CACHE).catch(function(e){
        console.log('Algunos archivos no se pudieron cachear:', e);
      });
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

self.addEventListener('message', function(evento){
  if(evento.data === 'skipWaiting') self.skipWaiting();
});

// FIX: Estrategia network-first con timeout de 3s + solo cachear GET status 200
self.addEventListener('fetch', function(evento){
  // FIX: Ignorar peticiones no GET (POST/PUT/DELETE de Supabase) y esquemas no soportados
  if(evento.request.method !== 'GET' || !evento.request.url.startsWith('http')){
    return;
  }

  // FIX: Timeout de 3 segundos - si la red no responde, usar caché
  var timeoutPromise = new Promise(function(resolve){
    setTimeout(function(){ resolve(null); }, 3000);
  });

  var networkPromise = fetch(evento.request).then(function(respuesta){
    // FIX: Solo cachear respuestas OK con status 200 (no cachear errores 4xx/5xx)
    if(respuesta && respuesta.ok && respuesta.status === 200 && respuesta.type === 'basic'){
      var copia = respuesta.clone();
      caches.open(CACHE_NOMBRE).then(function(cache){
        cache.put(evento.request, copia);
      });
    }
    return respuesta;
  });

  evento.respondWith(
    Promise.race([networkPromise, timeoutPromise])
      .then(function(resultado){
        if(resultado) return resultado;
        // Timeout - servir desde caché
        return caches.match(evento.request).then(function(cached){
          if(cached) return cached;
          // Si no hay en caché, intentar la red de todos modos
          return fetch(evento.request);
        });
      })
      .catch(function(){
        // Sin red y sin caché - intentar caché como último recurso
        return caches.match(evento.request);
      })
  );
});
