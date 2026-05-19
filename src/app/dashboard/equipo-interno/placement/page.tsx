import { getPlacementCalendar, getPlacementSummary } from '@/lib/queries/placement'
import PlacementDashboard from '@/components/equipo-interno/PlacementDashboard'

export default async function PlacementPage() {
  const year  = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  const [calendar, summary] = await Promise.all([
    getPlacementCalendar(year, month),
    getPlacementSummary(year, month),
  ])

  return (
    <PlacementDashboard
      initialCalendar={calendar}
      initialSummary={summary}
      initialYear={year}
      initialMonth={month}
    />
  )
}
