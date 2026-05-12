import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpSupabase } from '../supabase.js'

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    'get_weekly_cv_trend',
    'Get the weekly CV (curriculum vitae) submission trend. Can be filtered by specific vacancy. Returns data grouped by week, ordered chronologically.',
    {
      weeks: z
        .number()
        .int()
        .min(1)
        .max(52)
        .default(8)
        .optional()
        .describe('Number of weeks to look back (default 8, max 52)'),
      vacancy_id: z
        .string()
        .optional()
        .describe('Filter by specific vacancy UUID. If omitted, returns aggregated data for all vacancies.'),
    },
    async ({ weeks = 8, vacancy_id }) => {
      const clampedWeeks = Math.min(weeks ?? 8, 52)

      let query = mcpSupabase
        .from('vacancy_cv_weekly_kpi')
        .select('week_start, vacancy_id, candidate_count, baseline_count, synced_at')
        .order('week_start', { ascending: true })
        .limit(clampedWeeks * 200) // Allow for many vacancies per week

      if (vacancy_id) {
        query = query.eq('vacancy_id', vacancy_id)
      }

      const { data, error } = await query

      if (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: error.message }, null, 2),
            },
          ],
        }
      }

      // If no vacancy_id filter, aggregate by week
      if (!vacancy_id) {
        const weekMap: Record<string, { total: number; vacancy_count: number }> = {}
        for (const row of data ?? []) {
          const key = row.week_start
          if (!weekMap[key]) {
            weekMap[key] = { total: 0, vacancy_count: 0 }
          }
          weekMap[key].total += row.candidate_count ?? 0
          weekMap[key].vacancy_count++
        }

        const weeks_sorted = Object.entries(weekMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-clampedWeeks)
          .map(([week_start, info]) => ({
            week_start,
            total_cvs: info.total,
            vacancies_with_data: info.vacancy_count,
          }))

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  trend: weeks_sorted,
                  weeks_returned: weeks_sorted.length,
                  mode: 'aggregated_all_vacancies',
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // Vacancy-specific data — return per-week rows
      const rows = (data ?? []).slice(-clampedWeeks)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                trend: rows,
                weeks_returned: rows.length,
                vacancy_id,
                mode: 'single_vacancy',
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  server.tool(
    'get_kpi_metrics',
    'Get KPI metrics (success rate, discard rate, candidates, hired) for one or all principal vacancies. Returns per-vacancy breakdown plus global averages.',
    {
      vacancy_id: z
        .string()
        .optional()
        .describe('If provided, returns metrics only for that vacancy. Otherwise returns metrics for all principal vacancies.'),
    },
    async ({ vacancy_id }) => {
      let query = mcpSupabase
        .from('job_openings_kpi')
        .select(
          'id, title, tipo_profesional, is_vacante_principal, ratio_exito_contactados, ratio_descarte, total_candidates, hired_count, hiring_target'
        )
        .neq('title', 'BBDD')

      if (vacancy_id) {
        query = query.eq('id', vacancy_id)
      } else {
        query = query.eq('is_vacante_principal', true)
      }

      const { data, error } = await query

      if (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: error.message }, null, 2),
            },
          ],
        }
      }

      const vacancies = data ?? []

      // Compute global averages over principal vacancies
      const withRatio = vacancies.filter(
        (v) => v.ratio_exito_contactados !== null && v.ratio_exito_contactados !== undefined
      )
      const avgExito =
        withRatio.length > 0
          ? withRatio.reduce((s, v) => s + (v.ratio_exito_contactados ?? 0), 0) /
            withRatio.length
          : null

      const withDescarte = vacancies.filter(
        (v) => v.ratio_descarte !== null && v.ratio_descarte !== undefined
      )
      const avgDescarte =
        withDescarte.length > 0
          ? withDescarte.reduce((s, v) => s + (v.ratio_descarte ?? 0), 0) /
            withDescarte.length
          : null

      const totalCandidates = vacancies.reduce(
        (s, v) => s + (v.total_candidates ?? 0),
        0
      )
      const totalHired = vacancies.reduce((s, v) => s + (v.hired_count ?? 0), 0)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                vacancies: vacancies.map((v) => ({
                  id: v.id,
                  title: v.title,
                  tipo_profesional: v.tipo_profesional,
                  is_vacante_principal: v.is_vacante_principal,
                  total_candidates: v.total_candidates,
                  hired_count: v.hired_count,
                  hiring_target: v.hiring_target,
                  ratio_exito_contactados: v.ratio_exito_contactados,
                  ratio_descarte: v.ratio_descarte,
                })),
                aggregates: {
                  total_vacancies: vacancies.length,
                  total_candidates: totalCandidates,
                  total_hired: totalHired,
                  avg_ratio_exito: avgExito !== null ? Math.round(avgExito * 100) / 100 : null,
                  avg_ratio_descarte:
                    avgDescarte !== null ? Math.round(avgDescarte * 100) / 100 : null,
                },
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
