# Hackathon — Dashboard de Avance

Dashboard estático para trackear progreso del equipo. Sin servidor, sin cuenta. Estado guardado en `localStorage` del browser.

**Live:** se actualiza solo al deployar en Vercel.

---

## Cómo agregar o editar tareas

Todo está en `index.html`, objeto `data` al inicio del `<script>` (~línea 75).

### Estructura

```js
{
  id: "f1",              // ID único de la fase (no cambiar)
  title: "FASE 1",
  time: "Vie 18:00 – 22:00",
  frozen: false,         // true = bloquea checkboxes (scope freeze)
  tracks: [
    {
      id: "f1p1",        // ID único del track (no cambiar)
      name: "P1 — Frontend",
      color: "t1",       // t1=naranja t2=azul t3=violeta t4=verde
      tasks: [
        "Texto de la tarea",
        "Otra tarea",
      ]
    }
  ]
}
```

### Agregar una tarea

Encontrar el track correcto y agregar un string al array `tasks`:

```js
tasks: [
  "Tarea existente",
  "Nueva tarea aquí",   // ← agregar
]
```

### Agregar un track nuevo

Agregar un objeto al array `tracks` de la fase correspondiente:

```js
{ id: "f1p5", name: "P5 — DevOps", color: "t1", tasks: [
  "Configurar CI/CD",
  "Setup Docker",
]}
```

> **IDs deben ser únicos.** Si cambias un `id` existente, los checkmarks guardados para ese track se pierden.

### Marcar fase como frozen (scope freeze)

```js
{ id: "f4", ..., frozen: true, ... }
```

Los checkboxes quedan deshabilitados visualmente.

---

## Deploy

```bash
cd avance
vercel --prod
```

Requiere Vercel CLI: `npm i -g vercel`

---

## Colores de tracks

| Color | Clase | Hex     |
|-------|-------|---------|
| Naranja | `t1` | `#f97316` |
| Azul    | `t2` | `#3b82f6` |
| Violeta | `t3` | `#a855f7` |
| Verde   | `t4` | `#22c55e` |
