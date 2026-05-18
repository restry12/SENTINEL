# SENTINEL — Sistema de Alerta Temprana de Incendios

Sistema de monitoreo ambiental en tiempo real para América Latina. Detecta incendios forestales vía satélite NASA, analiza calidad del aire, predice expansión del fuego con agentes IA, monitorea glaciares y eventos meteorológicos severos (tornados/tormentas).

**Demo:** [sentinel-phi-six.vercel.app](https://sentinel-phi-six.vercel.app)

---

## Arquitectura

```
Make.com (NASA FIRMS + OpenWeather + OpenAQ)
   → POST /api/trigger/full  (responde 202 inmediato, análisis en background)
   → Orchestrator (Promise.allSettled, fault-isolated)
   → agent-fire · agent-weather · agent-air · agent-routes · agent-report
   → SentinelUpdate → Socket.io → Frontend (dashboard en vivo)
   → si riskLevel HIGH/CRITICAL → Make.com webhook → SMS / Gmail
```

Make.com hace todas las llamadas externas (NASA, OpenWeather, OpenAQ) y manda los datos embebidos al backend. El backend no fetchea nada externo — solo orquesta los agentes IA.

---

## Flujos de Make.com

| Escenario | Link público |
|---|---|
| Flujo principal (NASA FIRMS + alertas) | [Ver escenario](https://us2.make.com/public/shared-scenario/XZpPiTewABR/integration-webhooks-http) |
| Flujo de notificaciones (SMS / Gmail) | [Ver escenario](https://us2.make.com/public/shared-scenario/oyXzOIfPO3W/integration-webhooks) |
| Flujo de datos Sentinel | [Ver escenario](https://us2.make.com/public/shared-scenario/NHNjZ4Lag7a/integration-http-sentinel-data) |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16, Tailwind CSS, Mapbox GL JS, Socket.io client |
| Backend | Node.js + Express, Socket.io, Supabase |
| Agentes IA | TypeScript microservices, OpenRouter (Mistral Large) |
| Automatización | Make.com (NASA FIRMS, OpenWeather, OpenAQ) |
| Datos satelitales | NASA FIRMS (focos activos), GLIMS (glaciares) |
| Clima | Open-Meteo, OpenWeather |
| Alertas ciudadanas | Zavu (SMS), Gmail |
| Deploy | Render (backend + agentes), Vercel (frontend) |

---

## Servicios del backend

Monorepo TypeScript en `backend/`. Cada agente es un microservicio independiente.

| Servicio | Carpeta | Puerto |
|---|---|---|
| Backend principal | `packages/backend` | 3000 |
| Agent Fire (expansión + riesgo) | `packages/agent-fire` | 3001 |
| Agent Weather (clima) | `packages/agent-weather` | 3002 |
| Agent Air (calidad del aire) | `packages/agent-air` | 3003 |
| Agent Routes (evacuación) | `packages/agent-routes` | 3004 |
| Agent Report (reporte ejecutivo) | `packages/agent-report` | 3005 |
| Agent Glacier (glaciares) | `packages/agent-glacier` | 3006 |
| Agent Severe Weather (tornados) | `packages/agent-severe-weather` | 3007 |

---

## Estructura del repositorio

```
SENTINEL/
├── frontend/          # Next.js app (dashboard, mapas, chat IA)
├── backend/
│   ├── packages/
│   │   ├── backend/           # Orchestrator + Socket.io + auth
│   │   ├── agent-fire/        # Análisis de focos + predicción expansión
│   │   ├── agent-weather/     # Datos climáticos
│   │   ├── agent-air/         # Calidad del aire (PM2.5, AQI)
│   │   ├── agent-routes/      # Rutas de evacuación
│   │   ├── agent-report/      # Reporte ejecutivo de emergencia
│   │   ├── agent-glacier/     # Monitoreo de glaciares (GLIMS)
│   │   ├── agent-severe-weather/ # Tornados y tormentas severas (SSPI)
│   │   └── shared/types/      # Tipos compartidos (@sentinel/types)
│   └── package.json
└── cities_data/       # Base de datos de ciudades para geocoding
```

---

## Setup local

### Requisitos

- Node.js v18+
- npm o pnpm
- Cuenta en [OpenRouter](https://openrouter.ai) (LLM de los agentes)
- Proyecto en [Supabase](https://supabase.com)
- Token de [Mapbox](https://mapbox.com)

### Variables de entorno

**`frontend/.env.local`:**
```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
BACKEND_URL=http://localhost:3000
OPENROUTER_API_KEY=sk-or-...
```

**`backend/.env`** (ver `backend/.env.example`):
```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
OPENROUTER_API_KEY=
ALLOWED_ORIGIN=http://localhost:3010
AGENT_FIRE_URL=http://localhost:3001
AGENT_WEATHER_URL=http://localhost:3002
AGENT_AIR_URL=http://localhost:3003
AGENT_ROUTES_URL=http://localhost:3004
AGENT_REPORT_URL=http://localhost:3005
```

### Correr en local

```bash
# Backend (todos los agentes)
cd backend
npm install
npm run dev

# Frontend (en otra terminal)
cd frontend
pnpm install
pnpm dev   # → http://localhost:3010
```

---

## Deploy

| Componente | Plataforma | Branch | Root Dir |
|---|---|---|---|
| Backend + agentes | Render | `main` | `backend/` |
| Frontend | Vercel | `main` | `frontend/` |

**Variables de entorno críticas en Render:** `ALLOWED_ORIGIN` debe tener la URL pública de Vercel para que Socket.io acepte la conexión.

**Variables de entorno críticas en Vercel:** `NEXT_PUBLIC_SOCKET_URL` y `BACKEND_URL` deben apuntar a la URL de Render.
