import { config } from 'dotenv'
config({ path: '.env.local' })

import { importPlacementSchedule } from '../src/lib/google-sheets/import-placement-schedule'

async function main() {
  console.log('Starting placement schedule import…\n')

  const result = await importPlacementSchedule()

  console.log('=== Placement Schedule Import Results ===')
  console.log(`Members upserted : ${result.membersUpserted}`)
  console.log(`Schedules upserted: ${result.schedulesUpserted}`)

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`)
    for (const err of result.errors) {
      console.log(`  ✗ ${err}`)
    }
  } else {
    console.log('\nNo errors.')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
