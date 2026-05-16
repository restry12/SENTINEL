# Vista FIRE — Rediseno UX/UI

## Resumen

Rediseno completo de la vista principal del dashboard SENTINEL enfocada en "Fuego Actual". El usuario ve todos los focos activos, selecciona uno, y obtiene inteligencia operativa detallada en paneles laterales. La expansion proyectada (2H/6H/12H) depende del foco seleccionado.

## Layout

3 columnas: `[300px] [1fr] [320px]`

- **Top bar:** Brand + selector de modo (Fuego Actual / Zonas de Riesgo) + status + reloj UTC
- **Panel izquierdo (300px):** Lista de focos + resumen del seleccionado
- **Centro (flex):** Mapa satelital + control flotante 2H/6H/12H
- **Panel derecho (320px):** Inteligencia operativa del foco seleccionado

## Selector de modo

En el centro del top bar, dos opciones:
- **Fuego Actual** (activo por defecto, se implementa ahora)
- **Zonas de Riesgo** (visual preparado, funcionalidad futura)

Estilo: tabs/pills con borde y fondo sutil en el activo.

## Panel Izquierdo — FireListPanel

### Estructura

1. **Header fijo:** "FOCOS ACTIVOS" + conteo total
2. **Lista scrolleable:** Todos los focos ordenados por FRP descendente
3. **Footer fijo:** Resumen del foco seleccionado (FRP, viento, coords)

### FireListItem

Cada item muestra:
- ID del foco (FIRE-001, FIRE-002...)
- Badge de severidad (CRITICO / ALTO / MODERADO) con color
- Coordenadas resumidas
- FRP en MW

El foco seleccionado tiene borde de color, fondo tenue, y se distingue claramente.

### FireSummaryFooter

Datos del foco seleccionado en grid 2x2:
- FRP (MW)
- Viento (km/h + direccion)
- Brillo (K)
- Direccion de propagacion

## Mapa Central — FireMapView

### Comportamiento

- Al seleccionar un foco (lista o click en mapa): `flyTo` con zoom 12, duracion 1.2s
- Muestra todos los marcadores de focos con animacion de pulso
- El foco seleccionado tiene marcador resaltado (mas grande, glow mas intenso)
- Poligono de expansion segun el rango temporal activo
- Flecha de direccion de propagacion (linea punteada blanca)

### ExpansionControl (flotante)

- Posicion: top center del mapa, con backdrop blur
- 3 botones: 2H | 6H | 12H
- El activo tiene fondo de color + borde + shadow
- Solo existe cuando hay un foco seleccionado (siempre en nuestro caso)
- Default: 2H

### Poligono de expansion

3 zonas concentricas con opacidad decreciente:
- Core (25% del tiempo): opacidad alta, color intenso
- Mid (55% del tiempo): opacidad media
- Outer (100% del tiempo): opacidad baja, borde punteado

Colores por rango:
- 2H: rojos (#dc2626 → #f87171)
- 6H: naranjas (#c2410c → #fb923c)
- 12H: ambar (#b45309 → #fbbf24)

### Limpieza visual

- Sin barras laterales invasivas en el mapa
- Sin texto excesivo flotante
- Grid tactico sutil (muy baja opacidad)
- Corners tacticos discretos
- Chip "TRACKING X FIRES" arriba izquierda, pequeno

## Panel Derecho — FireIntelPanel

### Estructura (de arriba a abajo)

1. **ExpansionImpact** — Area afectada segun rango seleccionado
   - Numero grande: km2
   - Secundario: hectareas
   - Cambia al cambiar el rango 2H/6H/12H

2. **NearbyInfrastructure** — Puntos criticos dentro de 10km del foco
   - Hospitales, escuelas, infraestructura
   - Distancia en km
   - Maximo 3 items

3. **PriorityZones** — Zonas de evacuacion prioritaria
   - Tags/chips con nombres de zonas
   - Viene de agent-report

4. **Recommendations** — Acciones recomendadas
   - Lista numerada con bullets naranjas
   - Viene de agent-report (acciones_inmediatas)
   - Maximo 4 items

5. **SafeRouteCard** — Ruta segura mas cercana
   - Nombre de ruta + destino
   - Estado (LIBRE/CONGESTIONADA/BLOQUEADA)
   - Tiempo estimado en minutos
   - Fondo verde sutil

### Regla de actualizacion

Todo el panel se actualiza cuando:
- Cambia el foco seleccionado (selectFire)
- Cambia el rango temporal (setExpansionRange) → solo afecta ExpansionImpact

## Contexto de Estado — FireViewContext

Evoluciona `fire-selection-context.tsx` actual.

```typescript
interface FireViewState {
  selectedFire: SelectedFireData    // nunca null
  expansionRange: '2h' | '6h' | '12h'  // default '2h'
  fires: SelectedFireData[]         // ordenados por FRP desc
  viewMode: 'fire' | 'risk-zones'  // default 'fire'
}

interface FireViewActions {
  selectFire: (id: string) => void
  setExpansionRange: (range: '2h' | '6h' | '12h') => void
  setViewMode: (mode: 'fire' | 'risk-zones') => void
}
```

### Logica interna

- Consume `useSentinel()` y transforma `fires[]` a `SelectedFireData[]`
- Calcula expansion individual por foco usando coordenadas + viento global
- Ordena por FRP descendente
- Auto-selecciona el top al primer render
- Cuando llega un nuevo SentinelUpdate: si el foco seleccionado sigue existiendo, lo mantiene. Si no, auto-selecciona el mas critico.

## Flujo UX

1. Usuario entra → Modo "Fuego Actual" activo → focos se cargan
2. Auto-seleccion del foco mas critico (mayor FRP)
3. Mapa centra en el, poligono 2H visible, paneles llenos
4. Usuario clickea otro foco (lista o mapa) → flyTo + paneles actualizan, rango se mantiene
5. Usuario cambia 2H→6H→12H → poligono cambia, panel derecho actualiza impacto
6. Nuevo SentinelUpdate llega → lista se actualiza, seleccion se preserva si es posible

## Componentes y Archivos

### Nuevos
- `components/dashboard/fire-list-panel.tsx` — panel izquierdo completo
- `components/dashboard/fire-map-view.tsx` — mapa + control expansion
- `components/dashboard/fire-intel-panel.tsx` — panel derecho completo
- `components/dashboard/expansion-control.tsx` — botones 2H/6H/12H
- `contexts/fire-view-context.tsx` — estado central

### Modificados
- `app/dashboard/page.tsx` — nuevo layout con los componentes nuevos
- `components/dashboard/top-bar.tsx` — agregar selector de modo

### Eliminados (reemplazados)
- `components/dashboard/left-panel.tsx` → FireListPanel
- `components/dashboard/right-panel.tsx` → FireIntelPanel
- `components/dashboard/map-panel.tsx` → FireMapView
- `components/dashboard/mapbox-panel.tsx` → integrado en FireMapView
- `contexts/fire-selection-context.tsx` → FireViewContext

## Estilo Visual

- Fondo oscuro premium (#080c14 base)
- Cards con bordes sutiles (rgba(255,255,255,0.06))
- Tipografia monospace para datos numericos
- Colores de severidad: rojo critico, naranja alto, ambar moderado
- Spacing consistente (16px padding, 12px gap)
- Sin emojis — iconos Lucide unicamente
- Glow effects sutiles en indicadores de estado
- Transiciones de 200ms en hover/seleccion

## Reglas de Interaccion

1. Click en foco (lista) → mapa flyTo + paneles actualizan
2. Click en marcador (mapa) → lista scrollea al foco + paneles actualizan
3. Click en 2H/6H/12H → poligono cambia + ExpansionImpact cambia
4. Bidireccional: lista ↔ mapa siempre sincronizados
5. Hover en foco (lista): highlight sutil sin seleccionar
6. Al llegar nuevo update, no hay flash ni reinicio — transicion suave
