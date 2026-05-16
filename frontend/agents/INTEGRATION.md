# P3 Agents — Guía de Integración para P2

## Cómo usar el pipeline

```js
const { runPipeline } = require('../agents/index.js');

const results = await runPipeline(nasaData, climateData, aqiData, location, roadNetwork);
// results = { a1, a2, a3, a4, a5 }
```

## Inputs esperados

### `nasaData` — NASA FIRMS
```json
{
  "hotspots": [
    { "lat": -38.5, "lon": -71.2, "brightness": 412, "confidence": 91, "frp": 87.3 }
  ],
  "acq_date": "2026-05-15",
  "region": "Araucanía, Chile"
}
```

### `climateData` — OpenWeather
```json
{
  "wind_speed_kmh": 45,
  "wind_direction": "NW",
  "humidity_pct": 18,
  "temp_celsius": 34,
  "precipitation_mm": 0
}
```

### `aqiData` — OpenAQ
```json
{
  "stations": [
    { "name": "Temuco Centro", "aqi": 187, "pm25": 95.3 }
  ]
}
```

### `location`
```json
{ "city": "Temuco", "region": "Araucanía", "country": "Chile" }
```

### `roadNetwork` — OpenRouteService
```json
{
  "rutas_principales": ["Ruta 5 Sur", "Ruta 199"],
  "ciudades_cercanas": ["Temuco", "Villarrica", "Loncoche"]
}
```

## Outputs por agente

| Agente | Output |
|--------|--------|
| A1 | `{ risk_level, zona_afectada, confianza, resumen }` |
| A2 | `{ expansion_2h, expansion_6h, expansion_12h, velocidad_propagacion_kmh, direccion_principal }` — GeoJSON polygons |
| A3 | `{ alertas: [{ zona, aqi, color, nivel, recomendacion }], resumen_general }` |
| A4 | `{ reporte_id, nivel_emergencia, poblacion_en_riesgo_estimada, acciones_inmediatas, resumen_ejecutivo, ... }` |
| A5 | `{ rutas: [{ nombre, instrucciones, estado, prioridad, ... }], punto_encuentro_principal, mensaje_alerta }` |

## Variables de entorno requeridas

En `backend/.env`:
```
OPENROUTER_API_KEY=sk-or-...
```

## Modelos usados

- A1 + A2: `mistralai/mistral-large` (mayor precisión para riesgo y expansión)
- A3 + A4 + A5: `mistralai/mistral-large` (mismo modelo vía OpenRouter)

## Ejemplo endpoint Express

```js
const { runPipeline } = require('../agents/index.js');

app.post('/api/analyze', async (req, res) => {
  const { nasaData, climateData, aqiData, location, roadNetwork } = req.body;
  const results = await runPipeline(nasaData, climateData, aqiData, location, roadNetwork);
  res.json(results);
});
```
