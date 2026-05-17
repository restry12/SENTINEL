# CLAUDE.md — Sentinel

## Reglas para Claude Code (todos los integrantes)

- Nunca hagas `git push --force`
- Nunca hagas `git reset --hard` después de un push
- Antes de cualquier push, pide confirmación explícita al usuario
- Nunca incluyas `.env` en commits
- Siempre haz `git pull origin main` antes de proponer un push

## Carpetas por integrante

- `frontend/` → P1
- `backend/` → P2
- `agents/` → P3
- `data/` → compartida (coordinar antes de editar)

## Comandos permitidos sin confirmación

- `git status`
- `git diff`
- `git log`
- `git pull`

## Comandos que requieren confirmación del usuario

- `git push`
- `git commit`
- `git add`
- `git merge`
- `git rebase`

---

## Estado actual del proyecto (2026-05-16)

Sistema **completo funcionando end-to-end**, frontend cableado a datos en vivo.
**Repo unificado:** `frontend/` + `backend/` viven juntos en la branch **`main`**
(default del repo). Branches viejas (`frontend`, `backend`, `backend-pruebas`,
`frontendaire`) quedan como respaldo. Feature branches → PR → `main`.

```
Make.com (NASA FIRMS + OpenWeather + OpenAQ)
   → POST /api/trigger/full  (responde 202 al instante, análisis en background)
   → orchestrator (Promise.allSettled, fault-isolated)
   → agent-fire + agent-weather + agent-air + agent-routes (+ agent-report)
   → SentinelUpdate → Socket.io → frontend (dashboard en vivo)
   → si riskLevel high/critical → Make.com webhook → SMS/Gmail
```

**Decisión arquitectónica clave:** Make.com hace las 3 llamadas externas (NASA,
OpenWeather, OpenAQ). El backend NO fetchea nada externo — recibe todo embebido
por foco en el body de `/api/trigger/full`.

### Memoria de la página (último análisis)

El dashboard hidrata al cargar sin esperar a Make.com, en 3 capas:
- **Backend:** último `SentinelUpdate` en RAM + snapshot JSON en Supabase
  (tabla `last_snapshot`, sobrevive el cold start de Render). `GET /api/last`.
- **Socket:** al conectar un cliente, el backend reenvía el último `update`.
- **Frontend:** caché en `localStorage` → pintado instantáneo al recargar.

Servicio: `packages/backend/src/services/last-update.ts`. Requiere correr el
bloque `last_snapshot` de `supabase-schema.sql` en Supabase.

### Seguridad (hardening aplicado)

- **CORS restringido**: Socket.io ya NO usa `*`. Se permite solo lo que esté en
  la env `ALLOWED_ORIGIN` (CSV de orígenes, ej. la URL de Vercel).
- **Rate limiting HTTP**: `/api/trigger`, `/api/trigger/full`, `/api/trigger/csv`
  → máx 10 req por IP cada 15 min (`express-rate-limit`).
- **Fail-fast al arranque**: faltan `SUPABASE_URL/ANON/SERVICE` o `AGENT_*_URL`
  → el proceso sale (no arranca a medias).

### Deploy

| Componente | Dónde | Notas |
|---|---|---|
| Backend + 5 agentes | Render (`sentinel-0zkq.onrender.com`, branch **`main`**, Root Dir `backend`) | Socket.io necesita server persistente |
| Frontend (Next.js) | Vercel — Root Dir `frontend/`, branch **`main`** | Apunta al backend de Render. Hay `frontend/vercel.json`; install con `npm install` (mismatch de pnpm lockfile) |

Render free tier: cold start ~30-60s tras inactividad.

## Arquitectura del backend (packages/)

Monorepo TypeScript. Correr todo local: `npm install && npm run dev` desde `backend/`.

| Servicio | Carpeta | Puerto local |
|---|---|---|
| Backend principal | `packages/backend` | 3000 |
| Agent Fire | `packages/agent-fire` | 3001 |
| Agent Weather | `packages/agent-weather` | 3002 |
| Agent Air | `packages/agent-air` | 3003 |
| Agent Routes | `packages/agent-routes` | 3004 |
| Agent Report | `packages/agent-report` | 3005 |
| Tipos compartidos | `shared/types` (`@sentinel/types`) | — |

### HTTP API (backend)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/trigger/full` | Make.com manda `{fires:[...]}` con clima+pm25 embebido. **Responde 202 al instante** y corre el análisis en background (evita el timeout de 40s de Make). Rate limit 10/15min por IP |
| `POST` | `/api/trigger` · `/api/trigger/csv` | Análisis manual. Rate limit 10/15min por IP |
| `GET` | `/api/last` | Último `SentinelUpdate` (memoria de la página) |
| `POST` | `/api/fires/filter` | CSV NASA → top 50 focos por FRP |
| `POST` | `/api/auth/register\|login\|logout` · `GET /api/auth/me` | Auth con Supabase |
| `POST` | `/api/polling/start\|stop` · `GET /api/polling/status` | Control de polling (mín 10s) |
| `GET` | `/api/status` · `/health` | Estado / health |

Los resultados NO se devuelven por HTTP — van por Socket.io a todos los suscriptores.

### Socket.io — eventos (CORS restringido vía `ALLOWED_ORIGIN`)

**Cliente → Servidor:** `trigger` (rate limit 1/15s + lock global), `start-polling`, `stop-polling`, `subscribe`

**Servidor → Cliente:** `status` (loading/ok/error), `update` (SentinelUpdate), `alert` (solo high/critical)

### Contrato de agentes

Todos exponen `POST /analyze` con body `AgentRequest` y responden:
```ts
{ success: true; data: T } | { success: false; data: null; error: string }
```

### Variables de entorno (backend)

```
AGENT_FIRE_URL / AGENT_WEATHER_URL / AGENT_AIR_URL / AGENT_ROUTES_URL  (fail-fast)
SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY  (fail-fast — auth, historial, snapshot)
ALLOWED_ORIGIN  # CSV de orígenes permitidos para CORS (ej. URL de Vercel). Sin esto el socket rechaza al frontend
AGENT_REPORT_URL  # opcional
NASA_FIRMS_API_KEY / OPENWEATHER_API_KEY / OPENAQ_API_KEY / OPENROUTE_API_KEY
OPENROUTER_API_KEY  # LLM de todos los agentes (mistral-large)
MAKE_WEBHOOK_URL  # opcional
```

### Lógica de riesgo (orchestrator)

- **critical**: >5 fires FRP>100, o >2 + viento >10 m/s
- **high**: >2 fires FRP>100, o cualquiera + viento fuerte, o AQI >150
- **medium**: cualquier fire FRP>100, o AQI >100
- **low**: resto

## Frontend (`frontend/` en `main`)

Next.js 16 + pnpm. Ya NO es branch/worktree separado: vive en `frontend/` dentro
de `main`. Local: `cd frontend && pnpm dev` → **http://localhost:3010**
(`next dev -p 3010`; el 3000 local lo ocupa otro proceso).

- `frontend/.env.local` (gitignored, recrear en cada clone): `NEXT_PUBLIC_SOCKET_URL`
  + `BACKEND_URL` = `https://sentinel-0zkq.onrender.com`.
- Socket centralizado en `contexts/sentinel-context.tsx` (`SentinelProvider` +
  `useSentinelMetrics`). Paneles con datos en vivo y **fallback** a valores demo.
  Memoria: `hooks/use-socket.ts` hidrata de `localStorage` + `GET /api/last`.
- Mapa (`mapbox-panel`): focos + polígono + expansión 2h/6h/12h + rutas desde socket.
- Auth real vía **proxy**: `app/api/auth/login|register/route.ts` reenvían a
  `${BACKEND_URL}/api/auth/*` (Supabase). `AuthGuard` protege `/dashboard` y `/air`.
- Rutas: `/` → redirect `/login`; dashboard en `/dashboard`; simulador aire en `/air`.

### Deploy Vercel

Root Directory = `frontend/`, Production Branch = `main`, Install `npm install`
(hay `frontend/vercel.json`; pnpm lockfile da mismatch). Env en Vercel:
`NEXT_PUBLIC_SOCKET_URL` y `BACKEND_URL` = `https://sentinel-0zkq.onrender.com`.
Importante: setear `ALLOWED_ORIGIN` en Render = la URL pública de Vercel, si no
el socket rechaza la conexión.

### Archivos ignorados localmente

`frontend/next-env.d.ts` es autogenerado por Next.js y aparece siempre como
modificado. Está marcado con `git update-index --assume-unchanged` — no commitear.
Si vuelve a aparecer: `git update-index --assume-unchanged frontend/next-env.d.ts`.
