import { GlacierClimateData, GlacierMassData } from '@sentinel/types';

export function calculateGlacierRisk(climate: GlacierClimateData, history: GlacierMassData[]) {
  let score = 0;
  
  // 1. Factor Térmico (40%) - Basado en días sobre 0°C y anomalía térmica
  const thermalScore = Math.min((climate.days_above_zero / 45) * 30 + (climate.thermal_anomaly > 0 ? climate.thermal_anomaly * 5 : 0), 40);
  score += thermalScore;
  
  // 2. Factor de Masa (40%) - Basado en la pérdida histórica reciente
  const lastChange = history[history.length - 1]?.mass_change_mmwe || 0;
  let massScore = 0;
  if (lastChange < -1500) massScore = 40;
  else if (lastChange < -1000) massScore = 30;
  else if (lastChange < -500) massScore = 20;
  else if (lastChange < 0) massScore = 10;
  
  // Aceleración
  const avgChange = history.length > 1 
    ? history.slice(0, -1).reduce((acc, curr) => acc + curr.mass_change_mmwe, 0) / (history.length - 1)
    : lastChange;
  
  if (lastChange < avgChange) massScore += 5;
  score += Math.min(massScore, 40);
  
  // 3. Factor de Precipitación (20%) - Déficit de nieve
  const precipScore = Math.min((climate.snowfall_cm < 50 ? (50 - climate.snowfall_cm) / 50 * 20 : 0), 20);
  score += precipScore;
  
  return Math.round(Math.min(score, 100));
}

export function getRiskCategory(score: number): 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO' {
  if (score <= 25) return 'BAJO';
  if (score <= 50) return 'MEDIO';
  if (score <= 75) return 'ALTO';
  return 'CRITICO';
}
