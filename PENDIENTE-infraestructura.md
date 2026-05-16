# PENDIENTE — Infraestructura en riesgo (`/air`)

## Contexto

La página `/air` muestra en el mapa hospitales, colegios y servicios de emergencia
cercanos a la zona de incendio ("Infraestructura en riesgo"). **Antes esos puntos
estaban hardcodeados** (5 lugares fijos de La Araucanía). Ya se eliminaron.

El frontend **ya está listo** para recibir esos datos en vivo: lee el campo
`infrastructure` del `SentinelUpdate` que llega por Socket.io. Mientras ese campo
venga vacío, simplemente no se muestran marcadores (no hay nada falso).

**Falta conectar el origen de datos.** Esto se hace en 2 lugares: Make.com y el backend.

---

## Lo que el frontend espera

El `SentinelUpdate` debe incluir un array opcional `infrastructure`:

```jsonc
{
  "timestamp": "...",
  "fires": [...],
  "weather": {...},
  "airQuality": {...},
  // ... resto igual ...
  "infrastructure": [
    { "id": "h-001", "name": "Hospital Hernán Henríquez", "lat": -38.24, "lon": -72.35, "type": "hospital" },
    { "id": "s-001", "name": "Escuela La Araucanía",       "lat": -38.18, "lon": -71.62, "type": "school" },
    { "id": "e-001", "name": "Bomberos Lonquimay",          "lat": -38.44, "lon": -71.24, "type": "emergency" }
  ]
}
```

Reglas del campo:
- `type` solo puede ser: `"hospital"`, `"school"` o `"emergency"`.
- `lat` / `lon` en grados decimales (igual que los focos `fires`).
- `id` único por punto (cualquier string estable).
- `name` el nombre visible del lugar.
- Si no hay datos, mandar `[]` o no incluir el campo — el frontend lo maneja.

---

## Parte 1 — Make.com (lo que ve tu amigo)

Make.com ya arma el payload de `POST /api/trigger/full` con focos NASA + clima +
PM2.5. Hay que agregar un módulo que consiga la infraestructura cercana a la zona
del incendio y la incluya en el body.

**Fuente recomendada: OpenStreetMap Overpass API** (gratis, sin API key).

1. Calcular el centro de la zona = promedio de `lat`/`lon` de los focos.
2. Hacer un HTTP request (módulo HTTP de Make) a Overpass con una query que pida
   hospitales, colegios y bomberos en un radio de ~20 km del centro:

   ```
   POST https://overpass-api.de/api/interpreter
   Content-Type: text/plain

   [out:json][timeout:25];
   (
     node["amenity"="hospital"](around:20000,{LAT},{LON});
     node["amenity"="school"](around:20000,{LAT},{LON});
     node["amenity"="fire_station"](around:20000,{LAT},{LON});
   );
   out body;
   ```
   (Reemplazar `{LAT}` y `{LON}` por el centro calculado.)

3. Mapear la respuesta de Overpass al formato que espera el frontend:
   - `amenity=hospital`  → `type: "hospital"`
   - `amenity=school`    → `type: "school"`
   - `amenity=fire_station` → `type: "emergency"`
   - `id` → usar el `id` del nodo OSM (ej: `osm-123456`)
   - `name` → `tags.name` (si no tiene nombre, descartar el punto)
   - `lat` / `lon` → vienen directo del nodo

4. Agregar ese array al body de `POST /api/trigger/full` bajo la clave `infrastructure`.

---

## Parte 2 — Backend (`packages/backend`)

El backend debe dejar pasar el campo. Tres cambios chicos:

1. **`shared/types`** — agregar al tipo `SentinelUpdate`:
   ```ts
   infrastructure?: Array<{
     id: string; name: string; lat: number; lon: number;
     type: 'hospital' | 'school' | 'emergency'
   }>
   ```

2. **`packages/backend/src/routes/index.ts`** — en `POST /api/trigger/full`,
   leer `body.infrastructure` y pasarlo a `executeAndBroadcast` / `runAnalysis`.

3. **`packages/backend/src/services/orchestrator.ts`** — `runAnalysis` debe recibir
   el array de infraestructura y devolverlo tal cual dentro del `SentinelUpdate`
   (no necesita procesarlo, solo pasarlo). Si no llega, devolver `[]`.

No requiere tocar ningún agente — la infraestructura no se analiza, solo se muestra.

---

## Prompt listo para pegarle a un asistente (Make + backend)

> En el proyecto SENTINEL necesito agregar "infraestructura en riesgo" al flujo de datos.
> El frontend ya espera un campo `infrastructure` en el `SentinelUpdate` con esta forma:
> `[{ id, name, lat, lon, type }]` donde `type` es `"hospital" | "school" | "emergency"`.
>
> 1. En Make.com: agregar un módulo HTTP que consulte la Overpass API de OpenStreetMap
>    (`https://overpass-api.de/api/interpreter`) buscando `amenity=hospital`, `school` y
>    `fire_station` en un radio de 20 km del centro de los focos, mapear la respuesta al
>    formato de arriba (fire_station → "emergency", descartar nodos sin `name`), e incluir
>    ese array bajo la clave `infrastructure` en el body de `POST /api/trigger/full`.
> 2. En el backend: agregar el campo opcional `infrastructure` al tipo `SentinelUpdate`
>    (`shared/types`), leerlo en la ruta `/api/trigger/full` (`routes/index.ts`) y pasarlo
>    sin modificar hasta el `SentinelUpdate` que arma `runAnalysis` (`orchestrator.ts`).
>    Si no llega, devolver `[]`.
>
> No hay que tocar los agentes. La infraestructura solo se muestra, no se analiza.
