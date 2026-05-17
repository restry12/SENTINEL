# Design Spec: Agente-Glacier & Glacier Melt Risk Predictor

## 1. Overview
El módulo de Glaciares de SENTINEL tiene como objetivo monitorear el estado actual y predecir el riesgo de derretimiento de glaciares a nivel global. Combina datos históricos de cambio de masa (Copernicus), datos climáticos en tiempo real (Open-Meteo) y análisis predictivo generado por IA (Mistral).

## 2. Architecture

### Backend: `packages/agent-glacier`
- **Tecnología**: Node.js, Express, TypeScript.
- **Patrón**: Siguiendo el estándar de `agent-fire` y `agent-severe-weather`.
- **Endpoints**:
  - `GET /glaciers`: Devuelve la lista de glaciares base (incluyendo los 10 iniciales y los derivados del dataset Copernicus).
  - `GET /glaciers/risk-grid`: Devuelve un conjunto de datos ligeros (GeoJSON) para renderizar el heatmap de riesgo global.
  - `POST /analyze`: 
    - **Payload**: `{ glacierId, lat, lon }`.
    - **Proceso**:
      1. Obtiene historial de masa desde `data/copernicus-processed.json`.
      2. Obtiene clima actual/histórico reciente desde Open-Meteo API.
      3. Calcula el `Glacier Melt Risk Index`.
      4. Envía contexto al LLM (Mistral/OpenRouter).
    - **Respuesta**: Análisis completo (clima, masa, riesgo, predicción, texto IA).

### Frontend: `/glaciares`
- **Ruta**: `frontend/app/glaciares/page.tsx`.
- **Componentes**:
  - `GlacierMap`: Integración con Mapbox. Capa `heatmap` para riesgo global y marcadores para glaciares específicos.
  - `GlacierLeftPanel`: Lista/Buscador de glaciares y estadísticas rápidas.
  - `GlacierRightPanel`: Ficha detallada con gráficos de pérdida de masa y el análisis de Mistral.
  - `RiskIndicator`: Visualización del índice 0-100.

## 3. Data Strategy

### Copernicus (Histórico)
- **Dataset**: Glacier mass change gridded data (1976-present).
- **Procesamiento**: Se creará un script de pre-procesamiento para extraer series temporales de puntos clave (glaciares conocidos) y promedios regionales en un archivo JSON optimizado. Esto evita la dependencia de NetCDF en tiempo de ejecución.

### Open-Meteo (Real-time)
- **Uso**: Obtención de temperatura (promedio, máx), precipitación, nieve y días sobre 0°C para la ubicación del glaciar seleccionado.

### Catálogo de Glaciares
- Lista enriquecida con los nombres sugeridos (Grey, Perito Moreno, Aletsch, etc.) mapeados a sus coordenadas exactas.

## 4. Glacier Melt Risk Predictor (Logic)

El índice (0-100) se calcula ponderando:
1. **Factor Térmico (40%)**: Anomalía de temperatura actual vs histórica y días sobre 0°C.
2. **Factor de Masa (40%)**: Tendencia histórica de pérdida de masa (Copernicus) y aceleración reciente.
3. **Factor de Precipitación (20%)**: Déficit de nieve acumulada.

**Categorías**:
- **0-25 (Bajo)**: Azul.
- **26-50 (Medio)**: Amarillo.
- **51-75 (Alto)**: Naranja.
- **76-100 (Crítico)**: Rojo.

## 5. IA Integration (Mistral)
Se utilizará el `AgentResponse` estándar para devolver el JSON estructurado solicitado:
- `summary`: Resumen ejecutivo.
- `riskExplanation`: Por qué el riesgo es el que es.
- `prediction`: Evolución esperada.
- `urgentActions`: Lista de acciones.
- `publicAlert`: Mensaje simplificado.

## 6. Testing
- **Unit Tests**: Pruebas para la fórmula del Risk Index en el backend.
- **Mock Tests**: Verificación de la integración con OpenRouter.
- **UI Tests**: Verificación de la carga de glaciares en el mapa.
