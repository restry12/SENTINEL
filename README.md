# SENTINEL
AI-powered wildfire early warning system for Latin America.

## What it does
Detects active fire hotspots using NASA satellite data, predicts fire
spread based on wind vectors, monitors air quality in affected zones,
calculates safe evacuation routes in real time, and automatically alerts
citizens and authorities via SMS and AI voice calls.

## Stack
- **NASA FIRMS** — real-time satellite fire data
- **OpenWeather** — wind and climate data
- **OpenAQ** — air quality monitoring
- **OpenRouteService** — safe evacuation routing
- **OpenRouter** — 5 orchestrated AI agents
- **Zavu** — SMS and AI voice alerts
- **Faces** — AI avatar crisis operator
- **v0 by Vercel** — dashboard UI

## Live demo
[sentinel.vercel.app](https://sentinel.vercel.app)

## Team
Built in 48 hours for Hackaindies.

---

## Repo structure

```
sentinel/
├── frontend/   → P1
├── backend/    → P2
├── agents/     → P3
├── data/       → shared fallback JSONs
├── README.md
├── GIT_GUIDE.md  ← leer antes de hacer cualquier push
└── .gitignore
```

> Lee `GIT_GUIDE.md` antes de hacer tu primer push.
