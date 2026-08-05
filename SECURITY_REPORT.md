# Reporte de Auditoría de Seguridad — AGUATERO

**Fecha:** 2026-08-05
**Alcance:** repositorio `kustuemir/Aguatero` (PWA en GitHub Pages: `kustuemir.github.io/Aguatero`)
**Rama:** `fix/security-hardening-pwa`
**Marco de referencia:** OWASP Top 10 + Ley 25.326 (Protección de Datos Personales, Argentina)

> **Nota sobre el criterio de aceptación original:** este proyecto es un sitio
> estático (HTML/CSS/JS puro, sin `package.json`, sin build, sin framework).
> No hay `npm run build` ni `npm audit` que correr porque no hay dependencias
> de npm — el único código de terceros es el SDK de Supabase cargado desde
> CDN (jsdelivr), que se trata en este reporte con SRI en vez de `npm audit`.
> Lighthouse no está disponible en este entorno (headless sin Chrome) — al
> final del reporte dejo instrucciones para que lo corras vos en 1 minuto.

---

## TAREA 1 — Hallazgos de la auditoría

### 🔴 CRÍTICO — `admin.html` expone la `service_role key` de Supabase en el navegador
El panel admin le pide al administrador que **pegue la service_role key**
(la clave que bypassea TODAS las reglas de Row Level Security) en un input,
y la usa desde JavaScript del lado del cliente para llamar directamente a la
API de Supabase (`/auth/v1/admin/users`, `/rest/v1/suscripciones`, etc.).

Esta página está servida **públicamente** en GitHub Pages, sin ningún gate
de autenticación previo al formulario. El riesgo no es solo que alguien
"adivine" la key — es que la arquitectura en sí está mal: una clave que da
control total de la base de datos **no debe existir nunca en código que
corre en un navegador**, sin importar que el comentario diga "solo se guarda
en esta sesión". Cualquier XSS, extensión de navegador maliciosa, captura de
pantalla, o descuido al pegarla, compromete la base entera.

**Fix aplicado en este PR (mitigación inmediata, no estructural):**
- Banner de advertencia visible en la pantalla de login del panel.
- `<meta name="robots" content="noindex, nofollow">` + `robots.txt` para
  reducir que quede indexado/descubierto pasivamente.
- CSP + SRI también aplicados a `admin.html`.

**Fix pendiente (recomendado, requiere una decisión tuya):** migrar las
acciones administrativas a una función de servidor (puedo construirla como
backend function, guardando la service_role key como secreto de servidor,
nunca en el navegador). Avisame si querés que lo haga y te pido la key por
el formulario seguro de secretos (nunca por chat).

### 🟠 ALTO — Datos de clientes (PII) en texto plano en `localStorage`/`IndexedDB`
`clientes` (nombre, dirección, teléfono, deuda) se guardaba serializado como
JSON plano en `localStorage` y como respaldo en `IndexedDB`. Cualquier acceso
físico al celular, extensión de navegador, o app maliciosa con permisos de
almacenamiento, podía leer todos los datos de todos los clientes del reparto.
Bajo Ley 25.326 esto no cumple con "medidas de seguridad adecuadas" para
datos de terceros.

**Fix aplicado:** ver TAREA 2, punto 2.

### 🟡 MEDIO — XSS reflejado (self-XSS) en el buscador
`searchTerm` (lo que el repartidor escribe en el buscador de clientes) se
insertaba sin escapar en un `innerHTML` cuando no había resultados
(`"No se encontraron clientes con "` + `searchTerm`). El resto del código ya
usa `escapeHtml()` correctamente para nombre/dirección/nota de cliente — este
era el único lugar sin escapar.

**Fix aplicado:** se envuelve con `escapeHtml()`.

### 🟡 MEDIO — Sin Subresource Integrity (SRI) en el script de Supabase (CDN)
`index.html` y `admin.html` cargaban el SDK de Supabase desde jsdelivr con la
etiqueta flotante `@2` (sin versión fija) y sin `integrity`. Si el CDN o el
paquete fueran comprometidos, el navegador ejecutaría el código nuevo sin
ninguna verificación.

**Fix aplicado:** ver TAREA 2, punto 4.

### 🟡 MEDIO — Sin Content-Security-Policy ni headers de seguridad
No había CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
ni `Permissions-Policy` en ningún lado.

**Limitación real:** GitHub Pages **no permite configurar headers HTTP
custom** — no hay forma de mandar `X-Frame-Options` o `Strict-Transport-Security`
reales desde GitHub Pages. La única opción disponible ahí es un `<meta
http-equiv="Content-Security-Policy">`, que cubre bastante pero **no** soporta
`frame-ancestors` ni headers no-CSP (eso requiere un header HTTP real).

**Fix aplicado:** meta CSP en ambos HTML (cobertura parcial en GitHub Pages)
+ `_headers` (Cloudflare Pages/Netlify) y `vercel.json` con el set completo
de headers, listos para usar si en algún momento migrás el hosting.

### 🟢 BAJO — Service Worker: caching de datos sensibles
Revisado en detalle: el SW ya tenía `respuesta.type === 'basic'` como
condición para cachear, lo cual **ya excluía** correctamente las respuestas
cross-origin de Supabase (nunca se cacheaban). Igual se agregó una exclusión
explícita por URL (`supabase.co`, `/admin.html`, header `Authorization`) como
defensa en profundidad, más legible y a prueba de futuros cambios.

### 🟢 BAJO — Sin `security.txt` / `SECURITY.md`
No existían. Agregados en este PR (ver TAREA 2, punto 5) — **actualizá el
email de contacto en `.well-known/security.txt`**, puse un placeholder.

### ✅ Sin hallazgos
- **Secretos hardcodeados:** la única clave hardcodeada es la Supabase
  `anon key`. Esto **no es una vulnerabilidad** — la anon key está diseñada
  para ser pública; la protección real es RLS (ver `SECURITY.md`, sección de
  riesgo crítico de RLS — **confirmá que esté activo en las 3 tablas**, según
  las conversaciones previas quedó pendiente de verificar).
- **`eval()`:** no se usa en ningún archivo.
- **Historial de git:** se revisaron los 56 commits del repo, no hay claves
  reales filtradas en el historial (solo texto de ayuda mencionando dónde
  conseguir la key, sin el valor).
- **`npm audit` / dependencias:** no aplica — no hay `package.json`, es un
  sitio estático sin dependencias de npm.
- **IDs duplicados / funciones HTML rotas:** ninguno.

---

## TAREA 2 — Fixes aplicados en esta rama

### 1. Security headers
- `index.html` / `admin.html`: agregado `<meta http-equiv="Content-Security-Policy">`
  + `X-Content-Type-Options` + `Referrer-Policy` vía meta tags.
- `_headers` (Cloudflare Pages/Netlify) y `vercel.json` con el set completo:
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Strict-Transport-Security`, `Permissions-Policy`, `Content-Security-Policy`.
- **CSP elegida** (ajustada a lo que el proyecto realmente usa, sin `unsafe-eval`):
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self' https://*.supabase.co;
  manifest-src 'self';
  worker-src 'self';
  base-uri 'self';
  form-action 'self';
  ```
  **Por qué `'unsafe-inline'` en `script-src` y `style-src`:** toda la UI usa
  `onclick="..."` inline (generados dinámicamente en `app.js`) y `style="..."`
  inline en decenas de lugares. Sacar `unsafe-inline` de golpe rompería toda
  la interactividad de la app (cada botón, cada tarjeta de cliente). Es un
  trade-off real, no un descuido — **no** se usa `unsafe-eval` en ningún lado
  (cumple el requisito explícito). Recomiendo como mejora futura (no
  bloqueante) migrar los `onclick=""` a `addEventListener` con delegación de
  eventos, para poder sacar `unsafe-inline` de `script-src`.

### 2. Almacenamiento seguro (cifrado AES-GCM)
Se cifra todo el estado local (clientes, deudas, historial, stock) antes de
guardarlo en `localStorage` e `IndexedDB`:
- **Algoritmo:** AES-GCM 256 (Web Crypto API, nativo del navegador).
- **Clave:** derivada del UID del usuario logueado (Supabase Auth) vía
  PBKDF2 (100.000 iteraciones, SHA-256) — **no está hardcodeada, no se
  guarda en disco**, se deriva en memoria cada vez que hay sesión activa.
- **Compatibilidad hacia atrás:** los datos que ya estaban guardados en texto
  plano (de la versión anterior) se siguen leyendo bien — la función de carga
  detecta si el valor es el "sobre" cifrado (`{v,iv,data}`) o JSON plano viejo,
  y en el primer guardado posterior ya queda cifrado.
- **Fallback:** si el navegador no soporta Web Crypto (muy raro hoy), la app
  sigue funcionando guardando sin cifrar, para no romper el uso offline.
- **Nota honesta:** esto protege contra lectura casual del almacenamiento
  (DevTools de un tercero, backups de otras apps, etc.) mientras el celular
  está bloqueado/sin sesión activa. No protege contra un atacante con control
  total del dispositivo mientras el repartidor tiene la sesión abierta (ahí
  la clave se puede derivar igual que la app la deriva) — ninguna solución
  100% client-side puede evitar eso.

### 3. Service Worker
- Nunca cachea: requests a `supabase.co` (dato/auth), `/admin.html`, ni
  requests con header `Authorization` — excluidos explícitamente además del
  chequeo `response.type === 'basic'` que ya los excluía.
- Estrategia: network-first con timeout de 3s + cache-first como respaldo
  offline para assets estáticos (ya existía, se mantuvo).
- Limpieza de caches viejas en `activate` (ya existía, se mantuvo).
- Cache version bump a `v8` para forzar la actualización del SW con la nueva
  lógica en los dispositivos que ya tenían la app instalada.

### 4. CDN y código
- SDK de Supabase: pineado a la versión exacta `2.112.0` (antes usaba `@2`
  flotante, que rompería el SRI apenas jsdelivr sirva un patch nuevo) +
  atributo `integrity` (SHA-384) + `crossorigin="anonymous"`.
- XSS reflejado en el buscador: corregido con `escapeHtml()`.
- No había `eval()` ni `dangerouslySetInnerHTML` (no es React) que eliminar.
- No se agregó DOMPurify: los únicos `innerHTML` con datos externos ya usaban
  `escapeHtml()` (excepto el bug del buscador, ya corregido) — agregar una
  librería completa de sanitización para un solo caso ya resuelto sería
  peso extra sin necesidad real.

### 5. Archivos nuevos
- `.well-known/security.txt` — **actualizá el email de contacto**, puse un
  placeholder (`security@aguatero.app`).
- `SECURITY.md` — política de seguridad, incluye el riesgo crítico de
  `admin.html` documentado para que no se pierda de vista.
- `robots.txt` — bloquea que buscadores indexen `/admin.html`.
- `_headers` / `vercel.json` — headers reales, listos si migrás de hosting.

---

## Criterio de aceptación — estado real

| Criterio | Estado |
|---|---|
| `npm run build` pasa | **N/A** — no hay build, es HTML/CSS/JS estático |
| Sigue funcionando offline | ✅ verificado por lectura de código y sintaxis; recomiendo probar en tu celular antes de mergear |
| Lighthouse >90 Best Practices | ⏳ no pude correr Lighthouse en este entorno (sin Chrome headless). Instrucciones abajo para que lo corras vos en 1 min |
| Sin secretos en el código | ✅ revisado (anon key es pública por diseño, no hay service key ni tokens filtrados) |
| Rama separada, sin push a main | ✅ todo en `fix/security-hardening-pwa` |
| Reporte de seguridad | ✅ este archivo |

**Cómo correr Lighthouse vos mismo (1 minuto):** abrí la rama en GitHub Pages
de preview (o el sitio en producción) con Chrome de escritorio → F12 →
pestaña "Lighthouse" → categoría "Best Practices" → Analyze.

---

## Resumen de próximos pasos sugeridos (no incluidos en este PR)

1. **Confirmar que RLS está activo** en `clientes`, `movimientos` y
   `suscripciones` en Supabase (quedó pendiente de una conversación anterior).
2. Decidir si migramos `admin.html` a una función de servidor (elimina el
   riesgo crítico de la service_role key por completo).
3. (Opcional, no bloqueante) Migrar `onclick=""` inline a `addEventListener`
   para poder eventualmente sacar `'unsafe-inline'` de la CSP.
