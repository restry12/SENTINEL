import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import type { 
  GlacierAnalysis, 
  GlacierInfo, 
  GlacierClimateData, 
  GlacierMassData 
} from '@sentinel/types';
import { calculateGlacierRisk, getRiskCategory } from './risk-calculator';
import { callOpenRouter, parseJSON, MODELS } from './openrouter';

const DATA_DIR = path.join(__dirname, '../data');

export async function analyzeGlacier(glacierId: string): Promise<GlacierAnalysis> {
  // 1. Load Catalog and find glacier
  const catalogPath = path.join(DATA_DIR, 'glaciers-catalog.json');
  const catalog: GlacierInfo[] = JSON.parse(await fs.readFile(catalogPath, 'utf-8'));
  const glacier = catalog.find(g => g.id === glacierId);
  
  if (!glacier) {
    throw new Error(`Glacier with ID ${glacierId} not found`);
  }

  // 2. Load Mass Data
  const massPath = path.join(DATA_DIR, 'copernicus-processed.json');
  const allMassData: Record<string, GlacierMassData[]> = JSON.parse(await fs.readFile(massPath, 'utf-8'));
  const massHistory = allMassData[glacierId] || [];

  // 3. Fetch Climate Data from Open-Meteo
  const climateData = await fetchClimateData(glacier.lat, glacier.lon);

  // 4. Calculate Risk
  const riskIndex = calculateGlacierRisk(climateData, massHistory);
  const riskCategory = getRiskCategory(riskIndex);

  // 5. Generate Prediction (Simple heuristic)
  const lastMassChange = massHistory[massHistory.length - 1]?.mass_change_mmwe || 0;
  const trend = lastMassChange < -1000 ? 'Rápido retroceso' : lastMassChange < -500 ? 'Retroceso moderado' : 'Estable';
  const estimated_years_to_critical = lastMassChange < 0 ? Math.round(Math.abs(10000 / lastMassChange)) : null;

  // 6. Generate AI Analysis
  const llmAnalysis = await generateAIAnalysis(glacier, climateData, massHistory, riskIndex, riskCategory);

  return {
    glacierInfo: glacier,
    climateData,
    massHistory,
    riskIndex,
    riskCategory,
    prediction: {
      trend,
      estimated_years_to_critical
    },
    llmAnalysis
  };
}

async function fetchClimateData(lat: number, lon: number): Promise<GlacierClimateData> {
  // We use forecast API with past_days to get recent history
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_mean,precipitation_sum,snowfall_sum&timezone=auto&past_days=7&forecast_days=0`;
  
  const response = await axios.get(url);
  const daily = response.data.daily;
  
  const temp_avg = daily.temperature_2m_mean.reduce((a: number, b: number) => a + b, 0) / daily.temperature_2m_mean.length;
  const temp_max = Math.max(...daily.temperature_2m_max);
  const precipitation_mm = daily.precipitation_sum.reduce((a: number, b: number) => a + b, 0);
  const snowfall_cm = daily.snowfall_sum.reduce((a: number, b: number) => a + b, 0);
  const days_above_zero = daily.temperature_2m_max.filter((t: number) => t > 0).length;
  
  // Basic thermal anomaly calculation (relative to 0°C as baseline for glaciers)
  const thermal_anomaly = temp_avg > 0 ? temp_avg : 0;

  return {
    temp_avg: parseFloat(temp_avg.toFixed(2)),
    temp_max: parseFloat(temp_max.toFixed(2)),
    precipitation_mm: parseFloat(precipitation_mm.toFixed(2)),
    snowfall_cm: parseFloat(snowfall_cm.toFixed(2)),
    days_above_zero,
    thermal_anomaly: parseFloat(thermal_anomaly.toFixed(2))
  };
}

async function generateAIAnalysis(
  glacier: GlacierInfo,
  climate: GlacierClimateData,
  history: GlacierMassData[],
  riskIndex: number,
  riskCategory: string
): Promise<GlacierAnalysis['llmAnalysis']> {
  const system = "Eres un glaciólogo experto de SENTINEL. Analizas datos de glaciares y predices riesgos de derretimiento.";
  
  const user = `Analiza el estado del glaciar:
Información del Glaciar: ${JSON.stringify(glacier, null, 2)}
Datos Climáticos Recientes: ${JSON.stringify(climate, null, 2)}
Historial de Masa: ${JSON.stringify(history, null, 2)}
Índice de Riesgo: ${riskIndex}
Categoría de Riesgo: ${riskCategory}

Responde SOLO con JSON válido con la siguiente estructura:
{
  "summary": "Resumen ejecutivo",
  "riskExplanation": "Explicación detallada del riesgo",
  "prediction": "Predicción a futuro",
  "urgentActions": ["Acción 1", "Acción 2"],
  "monitoringRecommendations": ["Rec 1", "Rec 2"],
  "publicAlert": "Mensaje corto para el público"
}`;

  const raw = await callOpenRouter(MODELS.large, system, user);
  return parseJSON<GlacierAnalysis['llmAnalysis']>(raw, 'Glacier Agent');
}
