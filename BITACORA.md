# Bitácora del Proyecto — Lead Intel / HRS-Demo

> Registro de sesiones de desarrollo. Actualizado al final de cada sesión.

---

## Sesión 1-2 — Setup del entorno local en Windows
**Fecha:** 2026-03-12
**Participantes:** Alejandro Dominguez + Claude

### Objetivo
Levantar el proyecto HRS-Demo (fork de BSA-demo / Lead Intel) en Windows 11 local.

### Contexto del Proyecto
- **Repo origen:** BSA-demo (Juan Pablo DeHyl / jpdehyl)
- **Fork:** HRS-Demo — demo para Hawk Ridge Systems
- **Stack:** React 18 + Vite 7 + Express.js + PostgreSQL + Drizzle ORM + Gemini AI + Claude AI
- **Futuro:** White label — MVP para HRS pero se comercializará a otros clientes

### Problemas encontrados y soluciones

| Problema | Causa | Solución |
|---|---|---|
| `DATABASE_URL must be set` | dotenv no cargaba antes de db.ts en ESM | Usar `--env-file=.env` en el comando tsx |
| `ENOTSUP on socket 0.0.0.0:5000` | Windows no soporta `reusePort` | Eliminar opción del `httpServer.listen()` |
| `EADDRINUSE port 5000` | Puerto ocupado | Cambiar a PORT=3000 en .env |
| `504 Outdated Optimize Dep` | Múltiples causas: nanoid loop, process.exit crash, cacheDir con espacios | Remover nanoid, remover process.exit(1), configurar cacheDir en C:/vite-cache |
| `ERR_CONNECTION_REFUSED` | process.exit(1) en Vite logger mataba el server en warnings PostCSS | Remover el process.exit(1) |
| `NODE_ENV not recognized` | Windows PowerShell no soporta `NODE_ENV=x cmd` | Instalar y usar `cross-env` |
| Three.js / `@react-three` 504 loop | `@react-three/drei` genera URLs `@fs` con espacios en Windows | Remover Three.js de landing.tsx, reemplazar con CSS AnimatedBackground |

### Cambios al código

**`server/index.ts`**
- Agregar `import 'dotenv/config'` como primera línea
- Cambiar `httpServer.listen({ port, host, reusePort: true })` → `httpServer.listen(port, "0.0.0.0", callback)`

**`package.json`**
- Script dev: `"dev": "cross-env NODE_ENV=development tsx --env-file=.env server/index.ts"`

**`server/vite.ts`**
- Remover `nanoid()` del template de index.html
- Remover `process.exit(1)` del custom logger

**`vite.config.ts`**
- Agregar `cacheDir: "C:/vite-cache/hrs-demo"`
- Agregar `optimizeDeps: { include: ["@react-three/fiber", "@react-three/drei", "three"] }`

**`client/src/pages/landing.tsx`**
- Eliminar imports y componentes Three.js/WebGL
- Reemplazar con `AnimatedBackground` en CSS puro (partículas twinkle)

### Configuración del entorno

**.env configurado con:**
- `DATABASE_URL` → Supabase PostgreSQL (Session Pooler, IPv4)
- `SESSION_SECRET` → cadena aleatoria
- `GEMINI_API_KEY` → Google AI Studio
- `PORT=3000`

### Datos de demo

**Script:** `scripts/seedDemoData.ts`
**Emails cambiados:** `@bsasolutions.com` → `@hawkridgesys.com`
**Password:** `HRdemo2026`

**Usuarios creados:**
- 3 Managers (roberto.hernandez, carmen.delgado, luis.morales)
- 20 SDRs (carlos.martinez, maria.rodriguez, ana.torres, ...)
- 5 Account Executives
- 164 Leads con research packets
- ~508 Call sessions

**Nota:** El seed usa `onConflictDoNothing()` — si los usuarios ya existen no actualiza. Para re-seedear limpio usar `scripts/clearAndReseed.ts` primero.

### Estado final
- App corriendo en `http://localhost:3000` ✅
- Login con `carlos.martinez@hawkridgesys.com` / `HRdemo2026` ✅
- DB conectada a Supabase PostgreSQL ✅

---

## Sesión 3 — Branding GameTime.ai + Fix sesiones HTTP
**Fecha:** 2026-03-12
**Participantes:** Alejandro Dominguez + Claude

### Objetivo
Adaptar la identidad visual de la app al branding de GameTime.ai y resolver problemas de autenticación en desarrollo local.

### Contexto nuevo
- La solución forma parte de **GameTime.ai** (producto de GroundGame)
- Hawk Ridge Systems es el **primer cliente** (white label)
- La app se comercializará a múltiples clientes bajo la marca GameTime

### Branding GameTime.ai implementado

**Identidad visual:**
- Fondo negro puro `#000000`
- Acento azul eléctrico `#4A6CF7` (palabra "Unstoppable")
- Logo: tres cuadrados 🟥🟨🟦 (rojo `#EF4444`, amarillo `#EAB308`, azul `#3B82F6`)
- Tagline: *"The AI Layer That Makes Sales Teams Unstoppable"*
- Badge: "A product by GroundGame"

**Archivos modificados:**
- `client/src/pages/landing.tsx` — Rediseño completo: fondo negro, logo GameTime, hero con acento azul, tabs Lead Intel / Call Center / Analytics
- `client/src/pages/login.tsx` — Panel izquierdo con branding GameTime, mini feature cards con accent lines de colores
- `client/src/components/app-sidebar.tsx` — Logo GameTime (tres cuadrados + texto) reemplaza el SVG de HRS
- `client/index.html` — Title tag: "Lead Intel — GameTime.ai"

### Problemas encontrados y soluciones

| Problema | Causa | Solución |
|---|---|---|
| Login fallaba con `@hawkridgesys.com` | Seed anterior con `@bsasolutions.com` + `onConflictDoNothing()` no actualiza | Crear `clearAndReseed.ts`, limpiar DB y re-seedear |
| Password `HRdemo2026` no funcionaba | Seed corrido antes del cambio de password; `onConflictDoNothing()` saltó el update | Crear `updatePasswords.ts` para actualizar hashes directamente |
| Rate limiter bloqueaba login | Demasiados intentos fallidos (5/15min) | Reiniciar servidor (limpia el rate limiter in-memory) |
| Todas las API calls retornaban 401 | `cookie: { secure: true }` — cookie solo se envía sobre HTTPS, pero dev usa HTTP | Cambiar a `secure: process.env.NODE_ENV === "production"` en `server/routes.ts` |
| `EADDRINUSE port 3000` al reiniciar | Proceso anterior no terminado | `taskkill /F /IM node.exe` |

### Scripts de utilidad creados
- `scripts/clearAndReseed.ts` — Limpia todas las tablas y permite re-seedear desde cero
- `scripts/updatePasswords.ts` — Actualiza el hash de contraseña de todos los usuarios
- `scripts/checkAuth.ts` — Diagnóstico: verifica si un usuario existe y si el password es correcto
- `scripts/checkLeads.ts` — Lista usuarios con más leads asignados
- `scripts/checkDB.ts` — Cuenta registros en las tablas principales

### Estado final
- App con branding GameTime.ai ✅
- Login funcionando con `carlos.martinez@hawkridgesys.com` / `HRdemo2026` ✅
- Dashboard cargando con leads y Call Queue ✅
- Session cookie correcta en HTTP (dev) ✅

---

## Próximas sesiones — Pendientes

### En espera
- Cambios de JP para white label (afectan branding y configuración multi-tenant)

### Planificado (post JP)
Ver plan completo en `.claude/plans/cheerful-nibbling-teapot.md`

| Fase | Agente | Completitud actual | Esfuerzo |
|---|---|---|---|
| 1 | Dossier Agent (pre-call researcher) | 95% | 1-2h |
| 2 | Scrubbing Agent (pre-contact filter) | 70% | 3-4h |
| 3 | Handoff Agent (post-call bridge) | 70% | 5-6h |

---

*Bitácora iniciada: 2026-03-12*
