import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Env loading — handles multiline single-quoted values (e.g. service account JSON)
// ---------------------------------------------------------------------------

function loadEnvFile(p: string) {
  try {
    const content = readFileSync(p, 'utf-8')
    const lines = content.split(/\r?\n/)
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const t = line.trim()
      if (!t || t.startsWith('#')) { i++; continue }
      const eqIdx = t.indexOf('=')
      if (eqIdx < 0) { i++; continue }
      const k = t.slice(0, eqIdx).trim()
      let v = t.slice(eqIdx + 1).trim()

      // Multiline single-quoted value: KEY='{\n...\n}'
      if (v.startsWith("'") && !v.endsWith("'")) {
        const parts = [v]
        i++
        while (i < lines.length) {
          parts.push(lines[i])
          if (lines[i].endsWith("'")) { i++; break }
          i++
        }
        v = parts.join('\n')
      } else {
        i++
      }

      // Strip surrounding quotes (single or double)
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      v = v.replace(/\\n$/g, '').trim()
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

function repairServiceAccountEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return
  let obj: Record<string, string> | null = null
  try {
    obj = JSON.parse(raw)
  } catch {
    try {
      const unescaped = raw.replace(/\\"/g, '"')
      const fixed = unescaped.replace(
        /"private_key":"([\s\S]*?)"/,
        (_m, key) => {
          const safe = key
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
          return `"private_key":"${safe}"`
        },
      )
      obj = JSON.parse(fixed)
    } catch {
      return
    }
  }
  if (!obj) return
  if (typeof obj.private_key === 'string') {
    obj.private_key = obj.private_key.replace(/\\+n/g, '\n').replace(/\\+\n/g, '\n')
  }
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(obj)
}

repairServiceAccountEnv()

// ---------------------------------------------------------------------------
// Library imports (must come AFTER env repair)
// ---------------------------------------------------------------------------

import {
  importGermanyDropoutsForPromo,
  P25_COLUMN_MAP,
  type GermanyDropoutPromoConfig,
} from '@/lib/google-sheets/import-germany-dropouts'

// ---------------------------------------------------------------------------
// Promo configs
// ---------------------------------------------------------------------------

const PROMOS: GermanyDropoutPromoConfig[] = [
  {
    promo_numero: 24,
    spreadsheet_id: '1w9rMWkgdBzqWL05x_DPs3Ttdeax2tfvI3wsoQiGGbUw',
    gid: 1646413473, // tab " Dropouts (abandonos)"
    // Uses default P24_COLUMN_MAP (no columnMap needed)
  },
  {
    promo_numero: 25,
    spreadsheet_id: '1y-PaHgs6im6WHsu4jf0XjIyKyQ7fPgyuRHshSGEnn_g',
    gid: 1646413473, // tab " Dropouts (abandonos)"
    columnMap: P25_COLUMN_MAP, // P25 has no Profile column; cols 3-8 shifted left, lang cols at 12-16
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log(`║  Germany Dropouts Sync — ${new Date().toISOString().slice(0, 16)}     ║`)
  console.log('╚══════════════════════════════════════════════════╝\n')

  for (const promo of PROMOS) {
    console.log(
      `[promo ${promo.promo_numero}] Importing from sheet ${promo.spreadsheet_id} (gid=${promo.gid})...`,
    )

    try {
      const result = await importGermanyDropoutsForPromo(promo)
      console.log(`[promo ${promo.promo_numero}] Done:`, result)
    } catch (err) {
      console.error(`[promo ${promo.promo_numero}] Fatal error:`, err)
    }
  }

  console.log('\n✓ Sync complete')
}

main().catch(console.error)
