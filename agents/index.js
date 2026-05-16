require('dotenv').config({ path: __dirname + '/../backend/.env' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = {
  large: 'mistral/mistral-large-latest',
  small: 'mistral/mistral-small-latest',
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

// ─── Agent 1: Evaluador de Riesgo ────────────────────────────────────────────
// Input:  NASA FIRMS hotspot data + climate data (wind, humidity, temp)
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

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Agent 1 output no es JSON válido:\n${raw}`);
  }
}

// ─── Exports y pipeline ───────────────────────────────────────────────────────
async function runPipeline(nasaData, climateData, aqiData, roadNetwork) {
  console.log('🔥 SENTINEL Pipeline iniciado\n');

  console.log('[A1] Evaluando riesgo...');
  const a1Result = await agent1RiskEvaluator(nasaData, climateData);
  console.log('[A1] Result:', JSON.stringify(a1Result, null, 2));

  // A2–A5 se agregan en iteraciones siguientes
  return { a1: a1Result };
}

module.exports = { agent1RiskEvaluator, runPipeline };

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

  agent1RiskEvaluator(testNasa, testClimate)
    .then((result) => {
      console.log('\n✅ Agent 1 output:');
      console.log(JSON.stringify(result, null, 2));

      const required = ['risk_level', 'zona_afectada', 'confianza', 'resumen'];
      const missing = required.filter((k) => !(k in result));
      if (missing.length > 0) {
        console.error('❌ Faltan campos:', missing);
        process.exit(1);
      }
      console.log('\n✅ JSON válido y completo.');
    })
    .catch((err) => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
}
