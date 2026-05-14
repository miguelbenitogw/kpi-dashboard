import { getTeamMembers, getVacationSummary, getCalendarData } from '@/lib/queries/vacaciones'
import VacacionesDashboard from '@/components/equipo-interno/VacacionesDashboard'

export default async function VacacionesPage() {
  const year  = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  const [members, summary, calendar] = await Promise.all([
    getTeamMembers(),
    getVacationSummary(year),
    getCalendarData(year, month),
  ])

  return (
    <VacacionesDashboard
      members={members}
      summary={summary}
      calendarData={calendar}
      initialYear={year}
      initialMonth={month}
    />
  )
}
