'use server'

import { importExcelMadre } from '@/lib/google-sheets/import-madre'
import { importGlobalPlacement } from '@/lib/google-sheets/import-global-placement'

export interface RefreshGPResult {
  success: boolean
  madreUpdated: number
  madreInserted: number
  gpUpdated: number
  gpSkipped: number
  gpNotMatched: number
  errors: string[]
}

/**
 * Runs both imports in sequence:
 *   1. Excel Madre (Base Datos) → creates/updates candidates
 *   2. Global Placement → enriches candidates with gp_* fields
 */
export async function refreshGlobalPlacement(): Promise<RefreshGPResult> {
  const errors: string[] = []

  // Phase 1: Base Datos
  let madreUpdated = 0
  let madreInserted = 0
  try {
    const madre = await importExcelMadre()
    madreUpdated = madre.baseDatos.updated
    madreInserted = madre.baseDatos.inserted
    if (madre.errors.length > 0) errors.push(...madre.errors.slice(0, 3))
  } catch (err) {
    errors.push(`Base Datos: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Phase 2: Global Placement
  let gpUpdated = 0
  let gpSkipped = 0
  let gpNotMatched = 0
  try {
    const gp = await importGlobalPlacement()
    gpUpdated = gp.updated
    gpSkipped = gp.skipped
    gpNotMatched = gp.notMatched
    if (gp.errors.length > 0) errors.push(...gp.errors.slice(0, 3))
  } catch (err) {
    errors.push(`GP: ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    success: errors.length === 0,
    madreUpdated,
    madreInserted,
    gpUpdated,
    gpSkipped,
    gpNotMatched,
    errors,
  }
}
