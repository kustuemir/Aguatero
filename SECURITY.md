# Política de Seguridad — AGUATERO

## Alcance

AGUATERO es una PWA (app web instalable) para repartidores de agua. Maneja datos
personales de terceros (clientes): nombre, dirección, teléfono y saldo/deuda.
Estos datos están sujetos a la **Ley 25.326 de Protección de Datos Personales**
(Argentina).

## Reportar una vulnerabilidad

Si encontrás un problema de seguridad, por favor **no abras un issue público**.
Contactá de forma privada al mantenedor del repositorio (ver `.well-known/security.txt`).
Incluí: pasos para reproducir, impacto esperado, y si es posible, una prueba de concepto.

## Arquitectura de seguridad actual

- **Autenticación:** Supabase Auth (email + contraseña). El alta de usuarios es
  manual, controlada por el administrador (no hay auto-registro).
- **Datos en la nube:** Supabase Postgres. El acceso desde el cliente usa la
  `anon key` (pensada para ser pública) — la protección real depende de que
  **Row Level Security (RLS) esté activo en todas las tablas** (`clientes`,
  `movimientos`, `suscripciones`, etc.), con políticas que limiten cada fila
  al `user_id` del repartidor dueño de esos datos. **Verificar esto es la
  medida de seguridad más importante del proyecto** — sin RLS, cualquiera con
  la URL y la anon key (ambas públicas en el código, por diseño de Supabase)
  podría leer/escribir todos los datos de todos los repartidores.
- **Datos offline (en el celular):** se guardan en `localStorage` e `IndexedDB`
  **cifrados con AES-GCM 256** (Web Crypto API). La clave se deriva del UID
  del usuario logueado vía PBKDF2 — no está hardcodeada ni se persiste en disco.
  Ver detalle de la migración en `SECURITY_REPORT.md`.
- **Panel admin (`admin.html`):** usa la `service_role key` de Supabase, que
  **bypassea RLS por completo**. Es la pieza más delicada del proyecto — ver
  "Riesgo crítico pendiente" abajo.

## Riesgo crítico pendiente (requiere decisión del owner)

`admin.html` le pide al administrador que pegue la `service_role key` de
Supabase directamente en un campo de un formulario servido públicamente por
GitHub Pages, y la usa desde JavaScript en el navegador para llamar a la API
de Supabase. Esto es un antipatrón conocido: la service_role key debe vivir
**solo en un entorno de servidor**, nunca en código que corre en un navegador,
sin importar que "se guarde solo en la sesión".

**Recomendación:** mover las acciones administrativas (crear repartidor,
activar/vencer membresía, listar usuarios) a una función de backend, y que
`admin.html` llame a esa función en vez de usar la key directamente. Esto se
puede resolver como paso siguiente.

## Qué NO hace (por ahora) esta política

- No hay bug bounty ni compensación económica por reportes.
- No cubre servicios de terceros (Supabase, GitHub Pages, jsdelivr) — reportá
  esos problemas directamente a esos proveedores.
