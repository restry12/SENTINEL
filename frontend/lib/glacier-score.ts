import type { RiskCat, ScoreInputs } from "@/lib/glacier-types";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalize(v: number, min: number, max: number): number {
  return clamp((v - min) / (max - min), 0, 1) * 100;
}

export function calcRiesgo(inputs: ScoreInputs): number {
  const { areaNow, areaRef, tempAnomaly, elevation, cuencaFactor } = inputs;

  const retrocesoPct = areaRef > 0 ? Math.max(0, ((areaRef - areaNow) / areaRef) * 100) : 0;
  const retrocesoScore = clamp(retrocesoPct * 1.2, 0, 100);
  const tempScore = normalize(tempAnomaly, 0, 3);
  const elevScore = normalize(5500 - Math.max(0, elevation), 0, 5500);

  const areaScore =
    areaNow < 1 ? 90 :
    areaNow < 10 ? 70 :
    areaNow < 100 ? 50 :
    areaNow < 500 ? 30 : 15;

  const cuencaScore = clamp(cuencaFactor, 0, 100);

  const raw =
    retrocesoScore * 0.3 +
    tempScore * 0.25 +
    elevScore * 0.15 +
    areaScore * 0.2 +
    cuencaScore * 0.1;

  return Math.round(clamp(raw, 0, 100));
}

export function getCat(riesgo: number): RiskCat {
  if (riesgo >= 76) return "Critico";
  if (riesgo >= 51) return "Riesgo Alto";
  if (riesgo >= 26) return "Observacion";
  return "Estable";
}

export function getTrend(massHistory: number[]): "Retroceso acelerado" | "Retroceso lento" | "Estable" {
  if (massHistory.length < 4) return "Estable";
  const last = massHistory.slice(-4);
  const slope = (last[3] - last[0]) / 3;
  if (slope < -0.05) return "Retroceso acelerado";
  if (slope < -0.01) return "Retroceso lento";
  return "Estable";
}

export function getMasaVar(massHistory: number[]): string {
  if (massHistory.length === 0) return "N/D";
  const last = massHistory.at(-1) ?? 0;
  return `${last.toFixed(2)} m EH/anio`;
}

export function buildRiskHistory(areaHistory: number[], tempHistory: number[], baseRiesgo: number): number[] {
  if (areaHistory.length === 0) return Array.from({ length: 12 }, () => baseRiesgo);

  return areaHistory.map((areaPct, i) => {
    const areaFactor = (100 - areaPct) * 0.6;
    const tempFactor = (tempHistory[i] ?? 0) * 8;
    return clamp(Math.round(baseRiesgo - (areaFactor + tempFactor) * 0.3 + i * 0.5), 0, 100);
  });
}
