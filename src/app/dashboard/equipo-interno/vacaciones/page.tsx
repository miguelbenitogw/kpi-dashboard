import { getTeamMembers, getAllTeamMembers, getVacationSummary, getCalendarData } from '@/lib/queries/vacaciones'
import VacacionesDashboard from '@/components/equipo-interno/VacacionesDashboard'

export default async function VacacionesPage() {
  const year  = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  const [members, allMembers, summary, calendar] = await Promise.all([
    getTeamMembers(),
    getAllTeamMembers(),
    getVacationSummary(year),
    getCalendarData(year, month),
  ])

  return (
    <VacacionesDashboard
      members={members}
      allMembers={allMembers}
      summary={summary}
      calendarData={calendar}
      initialYear={year}
      initialMonth={month}
    />
  )
}
