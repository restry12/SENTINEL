import type { RiskAssessment, ExpansionData, AirAlerts, AuthorityReport } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

// A4: Authority Report — generates structured emergency report for services
export async function generateReport(
  a1: RiskAssessment,
  a2: ExpansionData,
  a3: AirAlerts
): Promise<AuthorityReport> {
  const system = `Eres un redactor experto de reportes de emergencia para servicios de bomberos, CONAF y autoridades civiles en Chile (especialmente zonas forestales del sur).
Recibes datos consolidados de un incendio activo.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
IMPORTANTE: Todas las referencias geográficas, instituciones y protocolos deben ser pertinentes a CHILE.
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
}`

  const user = `Evaluación de riesgo (A1):\n${JSON.stringify(a1, null, 2)}\n\nPredicción de expansión (A2):\n${JSON.stringify(a2, null, 2)}\n\nMonitor AQI/Salud (A3):\n${JSON.stringify(a3, null, 2)}\n\nGenera reporte estructurado para servicios de emergencia.`

  const raw = await callOpenRouter(MODELS.small, system, user)
  return parseJSON<AuthorityReport>(raw, 'Agent 4 (Report)')
}
