import infraData from '@/data/glacier-infra.json'
import type { InfraItem } from './glacier-types'

const INFRA = infraData as Record<string, InfraItem[] | undefined>

// Baseline de temperatura mensual (°C) a altitud glaciar por macrozona
// Fuente: ERA5 climatología 1981-2010, ajustada por gradiente altitudinal
const TEMP_BASELINE: Record<string, number[]> = {
  norte:      [5,  5,  4,  2,  0, -1, -1,  0,  2,  3,  5,  5],
  centro:     [8,  7,  6,  4,  1, -1, -2, -1,  1,  3,  6,  7],
  sur:        [6,  6,  4,  3,  1,  0, -1,  0,  1,  3,  5,  6],
  patagonia:  [5,  5,  4,  2,  1,  0, -1,  0,  1,  3,  4,  5],
}

export function getZone(lat: number): 'norte' | 'centro' | 'sur' | 'patagonia' {
  if (lat > -27) return 'norte'
  if (lat > -38) return 'centro'
  if (lat > -46) return 'sur'
  return 'patagonia'
}

export function getBaseline(lat: number): number[] {
  return TEMP_BASELINE[getZone(lat)]
}

export function getRegion(lat: number): string {
  if (lat > -30) return 'Región de Atacama'
  if (lat > -32) return 'Región de Coquimbo'
  if (lat > -33.5) return 'Región de Valparaíso'
  if (lat > -35) return 'Región Metropolitana'
  if (lat > -36) return "Región de O'Higgins"
  if (lat > -38) return 'Región del Maule'
  if (lat > -40) return 'Región del Biobío'
  if (lat > -42) return 'Región de Los Lagos'
  if (lat > -48) return 'Región de Aysén'
  return 'Región de Magallanes'
}

export function getCuenca(lat: number, lon: number): string {
  if (lat > -33.5 && lat < -33 && lon > -70.5) return 'Río Maipo · Cuenca Alto Maipo'
  if (lat > -33.5 && lat < -32.5 && lon > -70.5) return 'Río Aconcagua · Cuenca Aconcagua'
  if (lat > -35 && lat < -33.5) return 'Río Rapel · Cuenca Rapel'
  if (lat > -36 && lat < -35) return 'Río Tinguiririca · Cuenca Rapel'
  if (lat > -40 && lat < -36) return 'Río Biobío · Cuenca Biobío'
  if (lat > -42 && lat < -40) return 'Río Petrohué · Cuenca Los Lagos'
  if (lat > -45 && lat < -40) return 'Cuenca Palena-Puelo'
  if (lat > -48 && lat < -45) return 'Campo de Hielo Norte · Aysén / Cochrane'
  return 'Campo de Hielo Sur · Magallanes'
}

export function getPoblacion(lat: number): string {
  if (lat > -35) return 'Zona metropolitana y regiones V-RM'
  if (lat > -40) return 'Comunidades agrícolas y sanitarias regionales'
  if (lat > -45) return 'Comunidades lacustres y turismo regional'
  if (lat > -50) return 'Comunidades de Aysén y operadores turísticos'
  return 'PN Torres del Paine · operadores turísticos'
}

// Peso hídrico de cuenca: cuanto más crítica para agua, mayor peso
export function getCuencaFactor(lat: number): number {
  if (lat > -34 && lat < -33) return 95   // Maipo-RM: 8.4M hab
  if (lat > -33.5 && lat < -32) return 80  // Aconcagua
  if (lat > -36 && lat < -34) return 70    // Rapel / Tinguiririca
  if (lat > -40 && lat < -36) return 60    // Biobío
  if (lat > -45 && lat < -40) return 40    // Lagos
  return 30                                  // Patagonia: bajo uso hídrico
}

// Zones without dedicated infra data (Biobío, Los Lagos, Palena) fall to 'default'.
// Add zone keys to glacier-infra.json when infra data becomes available.
export function getInfra(lat: number, lon: number): InfraItem[] {
  if (lat > -33.5 && lat < -32.5 && lon > -70.5) return (INFRA.rm_maipo ?? INFRA['default'] ?? []) as InfraItem[]
  if (lat > -33.5 && lat < -32) return (INFRA.valpo_aconcagua ?? INFRA['default'] ?? []) as InfraItem[]
  if (lat > -36 && lat < -33.5) return (INFRA.ohiggins_rapel ?? INFRA['default'] ?? []) as InfraItem[]
  if (lat > -47 && lat < -45) return (INFRA.aysen_norte ?? INFRA['default'] ?? []) as InfraItem[]
  if (lat > -49 && lat < -47) return (INFRA.aysen_sur ?? INFRA['default'] ?? []) as InfraItem[]
  if (lat < -49) return (INFRA.magallanes ?? INFRA['default'] ?? []) as InfraItem[]
  return (INFRA['default'] ?? []) as InfraItem[]
}
