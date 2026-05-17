import { readFileSync } from 'fs'
import { join } from 'path'
import type { GlacierInfo, GlacierMassData } from '@sentinel/types'

export const catalog: GlacierInfo[] = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'glaciers-catalog.json'), 'utf-8')
)

export const copernicus: Record<string, GlacierMassData[]> = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'copernicus-processed.json'), 'utf-8')
)
