import { config } from 'dotenv'
config({ path: '.env.local' })
import { importVacaciones } from '../src/lib/google-sheets/import-vacaciones'

async function main() {
  console.log('Starting vacaciones sync...')
  const start = Date.now()

  try {
    const result = await importVacaciones()
    console.log('\nSync completed in', ((Date.now() - start) / 1000).toFixed(1), 'seconds')
    console.log('Members upserted:', result.membersUpserted)
    console.log('Vacation days upserted:', result.vacationDaysUpserted)
    console.log('Tabs processed:', result.tabsProcessed)
    console.log('Tabs skipped:', result.tabsSkipped)

    if (result.errors.length > 0) {
      console.log('\nErrors:')
      for (const err of result.errors) console.log(' -', err)
    }
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
