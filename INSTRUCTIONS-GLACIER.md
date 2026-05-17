# 🧊 Módulo de Glaciares - SENTINEL

Este módulo permite el monitoreo en tiempo real y la predicción del riesgo de derretimiento de glaciares a nivel global, combinando datos históricos de Copernicus, clima en vivo de Open-Meteo y análisis de IA con Mistral.

## 🚀 Cómo empezar

### 1. Configuración del Backend

El nuevo agente reside en `Backend/packages/agent-glacier`.

1. **Variables de Entorno**: Asegúrate de tener configurada la API Key de OpenRouter en `Backend/.env`.
   ```env
   OPENROUTER_API_KEY=tu_clave_aqui
   ```
2. **Instalación**:
   Desde la raíz de `Backend/`:
   ```bash
   npm install
   ```
3. **Ejecución**:
   Puedes correr solo el agente de glaciares o todos en conjunto:
   ```bash
   # Solo glaciares
   npm run dev -w packages/agent-glacier
   
   # Todo el ecosistema SENTINEL (incluye glaciares en el puerto 3006)
   npm run dev
   ```

### 2. Configuración del Frontend

La ruta principal es `/glaciares`.

1. **Ejecución**:
   Desde la raíz de `frontend/`:
   ```bash
   npm run dev
   ```
2. **Navegación**: Accede a `http://localhost:3010/glaciares` o usa el nuevo enlace en la **TopBar**.

## 🛠️ Arquitectura y Componentes

### Backend (`agent-glacier`)
- **`src/risk-calculator.ts`**: Contiene la lógica del **Glacier Melt Risk Index** (0-100).
- **`src/analyze.ts`**: Orquestador que une clima (Open-Meteo), historial (Copernicus) e IA (Mistral).
- **`data/`**: 
  - `glaciers-catalog.json`: Catálogo de glaciares reales con coordenadas.
  - `copernicus-processed.json`: Datos históricos de cambio de masa pre-procesados.

### Frontend (`/glaciares`)
- **`glacier-map.tsx`**: Integración con Mapbox. Incluye una capa de **Heatmap** que muestra el riesgo global basado en la pérdida de masa histórica.
- **`glacier-right-panel.tsx`**: Ficha técnica con gráficos de tendencia (Recharts) y el informe de IA.
- **`risk-indicator.tsx`**: Visualizador táctico del nivel de riesgo.

## 📊 Fuentes de Datos
- **Copernicus**: Datos de cambio de masa gridded (1976-presente).
- **Open-Meteo**: Clima actual (temperatura, nieve, precipitación).
- **Mistral (via OpenRouter)**: Generación de explicaciones y acciones urgentes.

## 📝 Notas para Colaboradores
- Para agregar un nuevo glaciar, solo debes añadir su entrada en `glaciers-catalog.json` y sus datos históricos en `copernicus-processed.json`. El sistema detectará automáticamente el punto en el mapa y permitirá su análisis.
- El Heatmap global se renderiza en base a los datos de `GET /glaciers/risk-grid`.
