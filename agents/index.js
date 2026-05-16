require('dotenv').config({ path: __dirname + '/../backend/.env' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = {
  large: 'mistralai/mistral-large',
  small: 'mistralai/mistral-large',
};

async function callAgent(model, systemPrompt, userMessage) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sentinel.vercel.app',
      'X-Title': 'SENTINEL',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

function parseJSON(raw, agentName) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`${agentName} output no es JSON válido:\n${raw}`);
  }
}

// ─── Agent 1: Evaluador de Riesgo ────────────────────────────────────────────
// Input:  NASA FIRMS hotspot data + climate data
// Output: JSON { risk_level, zona_afectada, confianza, resumen }
async function agent1RiskEvaluator(nasaData, climateData) {
  const system = `Eres un evaluador experto de riesgo de incendios forestales para Latinoamérica.
Recibes datos satelitales NASA FIRMS y datos climáticos.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "risk_level": "CRITICO" | "ALTO" | "MEDIO" | "BAJO",
  "zona_afectada": "nombre descriptivo de la zona geográfica",
  "confianza": número entre 0 y 1,
  "resumen": "descripción breve en español de la situación"
}`;

  const user = `Datos NASA FIRMS:
${JSON.stringify(nasaData, null, 2)}

Datos climáticos:
${JSON.stringify(climateData, null, 2)}

Evalúa el riesgo de incendio y responde con el JSON estructurado.`;

  const raw = await callAgent(MODELS.large, system, user);
  return parseJSON(raw, 'Agent 1');
}

// ─── Agent 2: Predictor de Expansión ─────────────────────────────────────────
// Input:  A1 JSON + climate data (wind)
// Output: JSON { expansion_2h, expansion_6h, expansion_12h } cada uno GeoJSON polygon
async function agent2ExpansionPredictor(a1Result, climateData) {
  const system = `Eres un experto en modelado de propagación de incendios forestales.
Recibes una evaluación de riesgo y datos de viento.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "expansion_2h": {
    "type": "Polygon",
    "coordinates": [[[lon, lat], ...]],
    "area_km2": número
  },
  "expansion_6h": {
    "type": "Polygon",
    "coordinates": [[[lon, lat], ...]],
    "area_km2": número
  },
  "expansion_12h": {
    "type": "Polygon",
    "coordinates": [[[lon, lat], ...]],
    "area_km2": número
  },
  "velocidad_propagacion_kmh": número,
  "direccion_principal": "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"
}
Genera polígonos realistas basados en la dirección e intensidad del viento.`;

  const user = `Evaluación de riesgo (Agent 1):
${JSON.stringify(a1Result, null, 2)}

Datos climáticos:
${JSON.stringify(climateData, null, 2)}

Predice la expansión del incendio a 2h, 6h y 12h con polígonos GeoJSON.`;

  const raw = await callAgent(MODELS.large, system, user);
  return parseJSON(raw, 'Agent 2');
}

// ─── Agent 3: Monitor AQI/Salud ───────────────────────────────────────────────
// Input:  AQI data + location
// Output: JSON { alertas: [{ zona, aqi, color, nivel, recomendacion }] }
async function agent3AQIMonitor(aqiData, location) {
  const system = `Eres un monitor experto de calidad del aire y salud pública en contexto de incendios.
Recibes datos de AQI (Air Quality Index) y ubicación.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "alertas": [
    {
      "zona": "nombre de la zona",
      "aqi": número,
      "color": "verde" | "amarillo" | "naranja" | "rojo" | "morado" | "granate",
      "nivel": "Bueno" | "Moderado" | "Dañino para grupos sensibles" | "Dañino" | "Muy dañino" | "Peligroso",
      "recomendacion": "instrucción concreta en español para la población"
    }
  ],
  "resumen_general": "evaluación general de la calidad del aire en la zona afectada"
}`;

  const user = `Datos AQI:
${JSON.stringify(aqiData, null, 2)}

Ubicación: ${JSON.stringify(location)}

Genera alertas de salud por zona con colores semánticos y recomendaciones.`;

  const raw = await callAgent(MODELS.small, system, user);
  return parseJSON(raw, 'Agent 3');
}

// ─── Agent 4: Reporte Autoridades ─────────────────────────────────────────────
// Input:  todo el contexto (A1, A2, A3)
// Output: JSON reporte estructurado para servicios de emergencia
async function agent4AuthorityReport(a1Result, a2Result, a3Result) {
  const system = `Eres un redactor experto de reportes de emergencia para servicios de bomberos, CONAF y autoridades civiles en Latinoamérica.
Recibes datos consolidados de un incendio activo.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "reporte_id": "SENTINEL-YYYYMMDD-XXX",
  "timestamp": "ISO 8601",
  "nivel_emergencia": "NIVEL 1" | "NIVEL 2" | "NIVEL 3",
  "zona_impacto": "descripción",
  "poblacion_en_riesgo_estimada": número,
  "recursos_recomendados": ["lista de recursos"],
  "acciones_inmediatas": ["lista de acciones priorizadas"],
  "zonas_evacuacion_prioritaria": ["lista de zonas"],
  "resumen_ejecutivo": "texto breve para autoridades"
}`;

  const user = `Evaluación de riesgo (A1):
${JSON.stringify(a1Result, null, 2)}

Predicción de expansión (A2):
${JSON.stringify(a2Result, null, 2)}

Monitor AQI/Salud (A3):
${JSON.stringify(a3Result, null, 2)}

Genera reporte estructurado para servicios de emergencia.`;

  const raw = await callAgent(MODELS.small, system, user);
  return parseJSON(raw, 'Agent 4');
}

// ─── Agent 5: Rutas Seguras ───────────────────────────────────────────────────
// Input:  expansion polygon + road network
// Output: texto en lenguaje natural con rutas de evacuación
async function agent5SafeRoutes(a2Result, roadNetwork) {
  const system = `Eres un experto en evacuaciones de emergencia y gestión de rutas seguras para incendios forestales.
Recibes polígonos de expansión del incendio y datos de red vial.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "rutas": [
    {
      "nombre": "nombre de la ruta",
      "origen": "punto de partida",
      "destino": "punto seguro de llegada",
      "distancia_km": número,
      "tiempo_estimado_min": número,
      "instrucciones": "descripción en lenguaje natural, clara y accionable",
      "estado": "LIBRE" | "CONGESTIONADA" | "BLOQUEADA",
      "prioridad": 1 | 2 | 3
    }
  ],
  "punto_encuentro_principal": "ubicación del punto de encuentro",
  "mensaje_alerta": "mensaje claro y urgente para la población en español"
}`;

  const user = `Polígonos de expansión del incendio (A2):
${JSON.stringify(a2Result, null, 2)}

Red vial disponible:
${JSON.stringify(roadNetwork, null, 2)}

Genera rutas de evacuación seguras con instrucciones en lenguaje natural.`;

  const raw = await callAgent(MODELS.small, system, user);
  return parseJSON(raw, 'Agent 5');
}

// ─── Pipeline completo ────────────────────────────────────────────────────────
async function runPipeline(nasaData, climateData, aqiData, location, roadNetwork) {
  console.log('🔥 SENTINEL Pipeline iniciado\n');

  console.log('[A1] Evaluando riesgo...');
  const a1 = await agent1RiskEvaluator(nasaData, climateData);
  console.log('[A1] ✅', a1.risk_level, '-', a1.zona_afectada);

  console.log('[A2] Prediciendo expansión...');
  const a2 = await agent2ExpansionPredictor(a1, climateData);
  console.log('[A2] ✅ Velocidad:', a2.velocidad_propagacion_kmh, 'km/h →', a2.direccion_principal);

  console.log('[A3] Monitoreando AQI...');
  const a3 = await agent3AQIMonitor(aqiData, location);
  console.log('[A3] ✅', a3.alertas.length, 'alertas generadas');

  console.log('[A4] Generando reporte autoridades...');
  const a4 = await agent4AuthorityReport(a1, a2, a3);
  console.log('[A4] ✅ Emergencia:', a4.nivel_emergencia);

  console.log('[A5] Calculando rutas seguras...');
  const a5 = await agent5SafeRoutes(a2, roadNetwork);
  console.log('[A5] ✅', a5.rutas.length, 'rutas de evacuación generadas');

  console.log('\n🏁 Pipeline completo.');
  return { a1, a2, a3, a4, a5 };
}

module.exports = {
  agent1RiskEvaluator,
  agent2ExpansionPredictor,
  agent3AQIMonitor,
  agent4AuthorityReport,
  agent5SafeRoutes,
  runPipeline,
};

// ─── Test directo ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const testNasa = {
    hotspots: [
      { lat: -38.5, lon: -71.2, brightness: 412, confidence: 91, frp: 87.3 },
      { lat: -38.52, lon: -71.18, brightness: 398, confidence: 85, frp: 62.1 },
    ],
    acq_date: '2026-05-15',
    region: 'Araucanía, Chile',
  };

  const testClimate = {
    wind_speed_kmh: 45,
    wind_direction: 'NW',
    humidity_pct: 18,
    temp_celsius: 34,
    precipitation_mm: 0,
  };

  const testAqi = {
    stations: [
      { name: 'Temuco Centro', aqi: 187, pm25: 95.3 },
      { name: 'Padre Las Casas', aqi: 210, pm25: 112.1 },
    ],
  };

  const testLocation = { city: 'Temuco', region: 'Araucanía', country: 'Chile' };

  const testRoads = {
    rutas_principales: ['Ruta 5 Sur', 'Ruta 199', 'Camino a Cunco'],
    ciudades_cercanas: ['Temuco', 'Villarrica', 'Loncoche'],
  };

  runPipeline(testNasa, testClimate, testAqi, testLocation, testRoads)
    .then((results) => {
      console.log('\n📋 Resultados completos:');
      console.log(JSON.stringify(results, null, 2));
    })
    .catch((err) => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
}
