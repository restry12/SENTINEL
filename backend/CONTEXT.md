# CONTEXT — Backend SENTINEL (estado actual)

Última actualización: 2026-05-16
Rama de trabajo: `backend-pruebas` · Backend en Render: https://sentinel-0zkq.onrender.com

## Estado: funcionando end-to-end

Pipeline completo operativo. Los 5 agentes deployados en Render responden con análisis LLM real:

```
Make.com (NASA FIRMS + OpenWeather + OpenAQ)
   → POST /api/trigger/full
   → orchestrator (Promise.allSettled, fault-isolated)
   → agent-fire + agent-weather + agent-air + agent-routes (+ agent-report)
   → SentinelUpdate → Socket.io → frontend
```

Decisión arquitectónica clave: **Make.com hace las 3 llamadas externas**. El backend
NO fetchea NASA, OpenWeather ni OpenAQ — recibe todo embebido en cada foco.

## Servicios en Render

| Servicio | URL | Env vars propias |
|---|---|---|
| Backend principal | sentinel-0zkq.onrender.com | `AGENT_*_URL`, `OPENROUTER_API_KEY` |
| agent-fire | sentinel-agent-fire.onrender.com | `OPENROUTER_API_KEY` |
| agent-weather | sentinel-agent-weather.onrender.com | `OPENROUTER_API_KEY` |
| agent-air | sentinel-agent-air.onrender.com | `OPENROUTER_API_KEY` |
| agent-routes | sentinel-agent-routes.onrender.com | `OPENROUTER_API_KEY` + `OPENROUTE_API_KEY` |
| agent-report | sentinel-agent-report.onrender.com | `OPENROUTER_API_KEY` |

Cada agente lee `process.env.PORT` (Render asigna 10000).
Build: `npm install && npm run build -w packages/agent-X` · Start: `npm run start -w packages/agent-X` · Root Dir: `backend`

El backend principal requiere `AGENT_FIRE_URL`, `AGENT_WEATHER_URL`, `AGENT_AIR_URL`,
`AGENT_ROUTES_URL` (fail-fast al arranque). `AGENT_REPORT_URL` es opcional.

## Endpoints HTTP (backend principal)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/fires/filter` | Recibe CSV NASA (text/plain). Devuelve `{ fires, total, dangerous }` — top 50 por FRP desc |
| POST | `/api/trigger/full` | Recibe `{ fires:[...] }` con clima+pm25 embebido por foco. Dispara análisis |
| POST | `/api/trigger` | Trigger manual `{ lat?, lon?, firms?, firmsCSV? }` |
| POST | `/api/trigger/csv` | CSV crudo de NASA (text/plain), header opcional `X-Weather-Data` |
| POST | `/api/polling/start\|stop` | Control de polling (intervalo mín 10s) |
| GET | `/api/polling/status` · `/health` | Estado |

Resultados NO se devuelven por HTTP — van por Socket.io a todos los suscriptores.

## Formato de `/api/trigger/full`

Make.com manda UN POST con todos los focos. Cada fire trae clima y aire embebidos:

```json
{ "fires": [
  { "lat": 16.43, "lon": -93.85, "frp": 9767, "brightness": 317,
    "speed": 1, "deg": 202, "humidity": 83,
    "date": "Sat, 16 May 2026 09:10:54 GMT", "pm25": 45.2 }
]}
```

El backend (`routes/index.ts`):
- Separa campos de fuego (`lat,lon,frp,brightness,date→timestamp`) del clima
- Usa el clima del **primer foco** (mayor FRP) para el análisis general
- Usa el **pm25 más alto** entre todos los focos (peor aire = más relevante para riesgo)
- `pm25` puede llegar `null` (OpenAQ sin estación cerca) → se descarta con filtro de tipo

## Lógica de riesgo (orchestrator.ts)

- **critical**: >5 fires FRP>100, o >2 + viento >10 m/s
- **high**: >2 fires FRP>100, o cualquiera + viento fuerte, o AQI >150
- **medium**: cualquier fire FRP>100, o AQI >100
- **low**: resto
- Alerta a Make.com webhook (SMS/Gmail) solo si riskLevel es high/critical

## Contrato de agentes

`POST /analyze` con body `AgentRequest`, responde `AgentResponse<T>`:
`{ success: true, data: T } | { success: false, data: null, error }`

- agent-fire: `{ firms, weather }` → polygon + riskAssessment + expansion (corre A1→A2 secuencial)
- agent-weather: `{ weather, firms }` → windDirection, spreadRisk, humidityRisk + insight LLM
- agent-air: `{ openaq, firms }` → alertas por zona (AQI, color, recomendación)
- agent-routes: `{ firms }` → rutas de evacuación
- agent-report: `{ riskAssessment, expansion, airAlerts }` → reporte de autoridades (solo si los 3 existen)

## Bugs resueltos (sesión 2026-05-16)

- OpenAQ 422 → eliminado fetch del backend; Make.com lo hace con `radius=25000` (máx v3)
- agent-weather no buildeaba → faltaba `await` en `/analyze` (TS2739)
- 413 Payload Too Large → `express.json/text` con `limit: '10mb'` (CSV grande de NASA)
- Iterator Make vacío → filtro `frp>50` muy alto para data real; ahora top 50 por FRP
- ECONNREFUSED → faltaba setear `AGENT_*_URL` en backend principal
- Make.com no tiene `toJSON()` → pm25 se manda escalar con `ifempty(...; "null")`

## Notas

- El orchestrator solo loggea FALLOS. Log vacío = todo OK.
- Verificación directa: `curl POST https://sentinel-agent-X.onrender.com/analyze` con payload mínimo.
- Render free tier: cold start ~30-60s en la primera request tras inactividad.
- Reglas git del repo: ver `CLAUDE.md` (pedir confirmación antes de push, nunca force/reset).
