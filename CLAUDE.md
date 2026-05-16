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

## Arquitectura del backend (packages/)

El backend vive en `packages/` como monorepo TypeScript. Correr todo: `npm run dev` desde la raíz.

### Servicios y puertos

| Servicio | Carpeta | Puerto |
|---|---|---|
| Backend principal | `packages/backend` | 3000 |
| Agent Fire | `packages/agent-fire` | 3001 |
| Agent Weather | `packages/agent-weather` | 3002 |
| Agent Air | `packages/agent-air` | 3003 |
| Agent Routes | `packages/agent-routes` | 3004 |
| Tipos compartidos | `packages/types` | — |

### Flujo de datos

```
NASA FIRMS + OpenWeather + OpenAQ
        ↓ (Promise.allSettled — fault isolated)
    orchestrator.ts
        ↓ llama en paralelo
agent-fire → GeoJSON polygon
agent-weather → WeatherAnalysis (interno)
agent-air → AirAnalysis (interno)
agent-routes → RouteData[] (ORS)
        ↓
    SentinelUpdate → Socket.io → frontend
        ↓ si riskLevel = high/critical
    Make.com webhook → SMS/Gmail
```

### HTTP API (backend puerto 3000)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/trigger` | Corre análisis una vez. Body opcional: `{ lat, lon }` |
| `POST` | `/api/polling/start` | Inicia polling. Body: `{ intervalMs }` (mín 10000) |
| `POST` | `/api/polling/stop` | Detiene polling |
| `GET` | `/api/polling/status` | Estado actual del polling |
| `GET` | `/health` | Health check |

Los resultados NO se devuelven por HTTP — van por Socket.io a todos los suscriptores.

### Socket.io — eventos

**Cliente → Servidor:** `trigger`, `start-polling`, `stop-polling`, `subscribe`

**Servidor → Cliente:** `status` (loading/ok/error), `update` (SentinelUpdate), `alert` (solo high/critical)

### Contrato de agentes

Todos exponen `POST /analyze` con body `AgentRequest` y responden `AgentResponse<T>`:

```ts
{ success: true; data: T } | { success: false; data: null; error: string }
```

### Variables de entorno requeridas

```
AGENT_FIRE_URL / AGENT_WEATHER_URL / AGENT_AIR_URL / AGENT_ROUTES_URL
NASA_FIRMS_API_KEY / OPENWEATHER_API_KEY / OPENAQ_API_KEY / OPENROUTE_API_KEY
MAKE_WEBHOOK_URL  # opcional
```

### Lógica de riesgo

- **critical**: >5 fires FRP alto, o >2 + viento >10 m/s
- **high**: >2 fires, o cualquier fire + viento fuerte, o AQI >150
- **medium**: cualquier fire, o AQI >100
- **low**: sin fires, aire aceptable
