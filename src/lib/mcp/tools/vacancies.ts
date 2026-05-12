import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpSupabase } from '../supabase.js'

export function registerVacancyTools(server: McpServer) {
  server.tool(
    'search_vacancies',
    'Search job vacancies (ofertas de trabajo) in the KPI system. Always excludes BBDD vacancies. Returns id, title, tipo_profesional, is_vacante_principal, total_candidates, hired_count.',
    {
      title: z.string().optional().describe('Filter by title (partial match, case-insensitive)'),
      is_principal: z
        .boolean()
        .optional()
        .describe('Filter to only principal vacancies (true) or only non-principal (false)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .optional()
        .describe('Number of results to return (default 20, max 100)'),
    },
    async ({ title, is_principal, limit = 20 }) => {
      const clampedLimit = Math.min(limit ?? 20, 100)

      let query = mcpSupabase
        .from('job_openings_kpi')
        .select(
          'id, title, tipo_profesional, is_vacante_principal, total_candidates, hired_count, hiring_target, closing_date, date_opened, zoho_job_number'
        )
        .neq('title', 'BBDD')
        .limit(clampedLimit)

      if (title) {
        query = query.ilike('title', `%${title}%`)
      }

      if (is_principal !== undefined && is_principal !== null) {
        query = query.eq('is_vacante_principal', is_principal)
      }

      const { data, error } = await query

      if (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: error.message, hint: error.hint }, null, 2),
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                vacancies: data ?? [],
                returned: (data ?? []).length,
                filters: { title, is_principal, limit: clampedLimit },
                note: 'BBDD vacancies are always excluded from results.',
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
    'get_vacancy_detail',
    'Get detailed information for a specific vacancy: base data, status breakdown, CV trend for last 6 weeks, and GW tags.',
    {
      vacancy_id: z.string().describe('The vacancy UUID from job_openings_kpi.id'),
    },
    async ({ vacancy_id }) => {
      const [baseResult, statusResult, cvsResult, tagsResult] = await Promise.all([
        // Base vacancy data
        mcpSupabase
          .from('job_openings_kpi')
          .select(
            'id, title, tipo_profesional, is_vacante_principal, total_candidates, hired_count, hiring_target, closing_date, date_opened, ratio_exito_contactados, ratio_descarte, zoho_job_number'
          )
          .eq('id', vacancy_id)
          .single(),

        // Status breakdown
        mcpSupabase
          .from('vacancy_status_counts_kpi')
          .select('status, count')
          .eq('vacancy_id', vacancy_id)
          .order('count', { ascending: false }),

        // CVs last 6 weeks
        mcpSupabase
          .from('vacancy_cv_weekly_kpi')
          .select('week_start, candidate_count, baseline_count, synced_at')
          .eq('vacancy_id', vacancy_id)
          .order('week_start', { ascending: false })
          .limit(6),

        // GW tags
        mcpSupabase
          .from('vacancy_tag_counts_kpi')
          .select('tag, count')
          .eq('vacancy_id', vacancy_id)
          .ilike('tag', 'GW%')
          .order('count', { ascending: false }),
      ])

      if (baseResult.error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { error: baseResult.error.message, vacancy_id },
                null,
                2
              ),
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                vacancy: baseResult.data,
                status_breakdown: statusResult.data ?? [],
                cv_weekly_trend: (cvsResult.data ?? []).reverse(), // ascending order for readability
                gw_tags: tagsResult.data ?? [],
                errors: [
                  statusResult.error?.message,
                  cvsResult.error?.message,
                  tagsResult.error?.message,
                ].filter(Boolean),
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
