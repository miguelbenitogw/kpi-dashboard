import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpSupabase } from '../supabase.js'

function getCurrentMondayISO(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export function registerDashboardTools(server: McpServer) {
  server.tool(
    'get_dashboard_summary',
    'Returns a high-level summary of the KPI Dashboard: active candidates in training, open principal vacancies, active promotions, and CVs received this week.',
    {},
    async () => {
      const today = new Date().toISOString().split('T')[0]
      const weekStart = getCurrentMondayISO()

      const [
        candidatesResult,
        vacanciesResult,
        promosResult,
        cvsResult,
        topVacanciesResult,
      ] = await Promise.all([
        // Active candidates in formation
        mcpSupabase
          .from('candidates_kpi')
          .select('id', { count: 'exact', head: true })
          .neq('estado_actual', 'Dropout')
          .neq('estado_actual', 'Graduado'),

        // Principal vacancies count
        mcpSupabase
          .from('job_openings_kpi')
          .select('id', { count: 'exact', head: true })
          .eq('is_vacante_principal', true)
          .neq('title', 'BBDD'),

        // Active promotions
        mcpSupabase
          .from('promotions_kpi')
          .select('id', { count: 'exact', head: true })
          .or(`fecha_fin.gt.${today},fecha_fin.is.null`),

        // CVs this week (sum)
        mcpSupabase
          .from('vacancy_cv_weekly_kpi')
          .select('candidate_count')
          .eq('week_start', weekStart),

        // Top 3 vacancies by CVs this week
        mcpSupabase
          .from('vacancy_cv_weekly_kpi')
          .select('vacancy_id, candidate_count, job_openings_kpi(title)')
          .eq('week_start', weekStart)
          .order('candidate_count', { ascending: false })
          .limit(3),
      ])

      const totalCvsThisWeek = (cvsResult.data ?? []).reduce(
        (sum: number, row: { candidate_count: number }) => sum + (row.candidate_count ?? 0),
        0
      )

      const summary = {
        active_candidates_in_formation: candidatesResult.count ?? 0,
        principal_vacancies: vacanciesResult.count ?? 0,
        active_promotions: promosResult.count ?? 0,
        cvs_this_week: {
          week_start: weekStart,
          total: totalCvsThisWeek,
        },
        top_vacancies_by_cvs_this_week: (topVacanciesResult.data ?? []).map(
          (row: Record<string, unknown>) => ({
            vacancy_id: row.vacancy_id,
            candidate_count: row.candidate_count,
            title:
              row.job_openings_kpi &&
              typeof row.job_openings_kpi === 'object' &&
              'title' in row.job_openings_kpi
                ? (row.job_openings_kpi as { title: string }).title
                : null,
          })
        ),
        errors: [
          candidatesResult.error?.message,
          vacanciesResult.error?.message,
          promosResult.error?.message,
          cvsResult.error?.message,
          topVacanciesResult.error?.message,
        ].filter(Boolean),
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      }
    }
  )
}
