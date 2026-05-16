require('dotenv').config({ path: __dirname + '/../.env' });
const { runPipeline } = require('./index.js');

const nasaData = {
  hotspots: [
    { lat: -38.5, lon: -71.2, brightness: 412, confidence: 91, frp: 87.3 },
    { lat: -38.7, lon: -71.4, brightness: 389, confidence: 85, frp: 62.1 }
  ],
  acq_date: "2026-05-16",
  region: "Araucanía, Chile"
};

const climateData = {
  wind_speed_kmh: 45,
  wind_direction: "NW",
  humidity_pct: 18,
  temp_celsius: 34,
  precipitation_mm: 0
};

const aqiData = {
  stations: [
    { name: "Temuco Centro", aqi: 187, pm25: 95.3 }
  ]
};

const location = { city: "Temuco", region: "Araucanía", country: "Chile" };

const roadNetwork = {
  rutas_principales: ["Ruta 5 Sur", "Ruta 199"],
  ciudades_cercanas: ["Temuco", "Villarrica", "Loncoche"]
};

async function main() {
  console.log('🔥 Corriendo pipeline de 5 agentes...\n');
  const results = await runPipeline(nasaData, climateData, aqiData, location, roadNetwork);

  console.log('\n── A1 Riesgo ──────────────────────────');
  console.log(JSON.stringify(results.a1, null, 2));
  console.log('\n── A2 Expansión ───────────────────────');
  console.log(JSON.stringify(results.a2, null, 2));
  console.log('\n── A3 AQI ─────────────────────────────');
  console.log(JSON.stringify(results.a3, null, 2));
  console.log('\n── A4 Reporte Autoridades ─────────────');
  console.log(JSON.stringify(results.a4, null, 2));
  console.log('\n── A5 Rutas Seguras ───────────────────');
  console.log(JSON.stringify(results.a5, null, 2));
}

main().catch(console.error);
