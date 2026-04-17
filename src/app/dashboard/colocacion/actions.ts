'use server'

import { importGlobalPlacement } from '@/lib/google-sheets/import-global-placement'

export interface RefreshGPResult {
  success: boolean
  updated: number
  skipped: number
  notMatched: number
  errors: string[]
}

export async function refreshGlobalPlacement(): Promise<RefreshGPResult> {
  try {
    const result = await importGlobalPlacement()
    return {
      success: true,
      updated: result.updated,
      skipped: result.skipped,
      notMatched: result.notMatched,
      errors: result.errors,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      updated: 0,
      skipped: 0,
      notMatched: 0,
      errors: [message],
    }
  }
}
