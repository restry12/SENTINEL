import type { RiskCategory } from '@/hooks/use-socket'

export const CATEGORY_COLOR: Record<RiskCategory, string> = {
  bajo: '#22c55e',
  medio: '#eab308',
  alto: '#f97316',
  critico: '#ef4444',
}

export const CATEGORY_LABEL: Record<RiskCategory, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  critico: 'Crítico',
}

export const PRIORITY_LABEL: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
}
