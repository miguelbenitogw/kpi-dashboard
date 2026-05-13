/**
 * Manual test runner for the institutions sync.
 * Run: npx tsx scripts/test-sync-institutions.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SPREADSHEET_ID = '1Lmw5SIbpobXBySaYEMXYw0YKMy6xP-cTAKm3-n6KPJY'

// Inline the import to avoid path-alias issues in tsx
async function main() {
  const { importInstitutions } = await import('../src/lib/google-sheets/import-institutions')

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║       SYNC INSTITUTIONS — FIRST RUN              ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`Spreadsheet: ${SPREADSHEET_ID}`)
  console.log('Starting...\n')

  const start = Date.now()

  try {
    const { total, byProfesion } = await importInstitutions(SPREADSHEET_ID)

    const duration = ((Date.now() - start) / 1000).toFixed(1)

    console.log(`\n${'═'.repeat(50)}`)
    console.log('TOTALS')
    console.log('═'.repeat(50))
    console.log(`  Inserted : ${total.inserted}`)
    console.log(`  Updated  : ${total.updated}`)
    console.log(`  Skipped  : ${total.skipped}`)
    console.log(`  Errors   : ${total.errors.length}`)
    console.log(`  Duration : ${duration}s`)

    console.log(`\n${'═'.repeat(50)}`)
    console.log('BY PROFESIÓN')
    console.log('═'.repeat(50))
    for (const [profesion, r] of Object.entries(byProfesion)) {
      const status = r.errors.length > 0 ? '⚠' : '✓'
      console.log(`\n${status} ${profesion}`)
      console.log(`    inserted=${r.inserted}  updated=${r.updated}  skipped=${r.skipped}  errors=${r.errors.length}`)
      if (r.errors.length > 0) {
        r.errors.slice(0, 5).forEach(e => console.log(`    ✗ ${e}`))
        if (r.errors.length > 5) console.log(`    ... y ${r.errors.length - 5} errores más`)
      }
    }

    if (total.errors.length > 0) {
      console.log(`\n${'═'.repeat(50)}`)
      console.log('ERRORS (first 10)')
      console.log('═'.repeat(50))
      total.errors.slice(0, 10).forEach(e => console.log(`  ✗ ${e}`))
    }

    console.log('\n✓ Done.')
  } catch (err) {
    console.error('\n✗ Fatal error:', err)
    process.exit(1)
  }
}

main()
