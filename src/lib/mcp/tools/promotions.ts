import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpSupabase } from '../supabase.js'

export function registerPromotionTools(server: McpServer) {
  server.tool(
    'get_promotion_list',
    'Get the list of promotions (promociones de formación). By default returns only active promotions.',
    {
      active_only: z
        .boolean()
        .default(true)
        .optional()
        .describe('If true (default), only return promotions that are currently active (fecha_fin > today or null)'),
    },
    async ({ active_only = true }) => {
      const today = new Date().toISOString().split('T')[0]

      let query = mcpSupabase
        .from('promotions_kpi')
        .select(
          'id, nombre, numero_promo, coordinador, cliente, fecha_inicio, fecha_fin, objetivo_atraccion, total_aceptados'
        )
        .order('numero_promo', { ascending: false })

      if (active_only) {
        query = query.or(`fecha_fin.gt.${today},fecha_fin.is.null`)
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
                promotions: data ?? [],
                total: (data ?? []).length,
                filter: active_only ? 'active only' : 'all',
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
    'get_promotion_detail',
    'Get detailed information for a specific promotion: base data, student count by status, and associated vacancies.',
    {
      promo_id: z.string().optional().describe('The promotion UUID from promotions_kpi.id'),
      promo_nombre: z
        .string()
        .optional()
        .describe('The promotion name (partial match). Used if promo_id is not provided.'),
    },
    async ({ promo_id, promo_nombre }) => {
      if (!promo_id && !promo_nombre) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { error: 'Either promo_id or promo_nombre must be provided.' },
                null,
                2
              ),
            },
          ],
        }
      }

      // Fetch the promotion
      let promoQuery = mcpSupabase
        .from('promotions_kpi')
        .select(
          'id, nombre, numero_promo, coordinador, cliente, fecha_inicio, fecha_fin, objetivo_atraccion, total_aceptados'
        )

      if (promo_id) {
        promoQuery = promoQuery.eq('id', promo_id)
      } else if (promo_nombre) {
        promoQuery = promoQuery.ilike('nombre', `%${promo_nombre}%`)
      }

      const { data: promoData, error: promoError } = await promoQuery.limit(1).single()

      if (promoError || !promoData) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: promoError?.message ?? 'Promotion not found',
                  filters: { promo_id, promo_nombre },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      const resolvedPromoId = promoData.id

      // Fetch students grouped by status
      const { data: studentsData, error: studentsError } = await mcpSupabase
        .from('promo_students_kpi')
        .select('estado')
        .eq('promo_id', resolvedPromoId)

      // Count by status
      const statusCounts: Record<string, number> = {}
      for (const student of studentsData ?? []) {
        const key = student.estado ?? 'Sin estado'
        statusCounts[key] = (statusCounts[key] ?? 0) + 1
      }

      // Fetch associated vacancies via candidate_job_history_kpi
      // First get candidate names from candidates_kpi for this promo
      const { data: candidateIds } = await mcpSupabase
        .from('candidates_kpi')
        .select('id')
        .eq('promocion_nombre', promoData.nombre)
        .limit(500)

      const ids = (candidateIds ?? []).map((c: { id: string }) => c.id)

      let associatedVacancies: Array<{
        vacancy_id: string
        title: string
        association_type: string
        candidate_count: number
      }> = []

      if (ids.length > 0) {
        const { data: historyData } = await mcpSupabase
          .from('candidate_job_history_kpi')
          .select(
            `
            job_opening_id,
            association_type,
            job_openings_kpi (
              id,
              title,
              is_vacante_principal
            )
          `
          )
          .in('candidate_id', ids)
          .neq('job_openings_kpi.title' as never, 'BBDD')

        // Group by vacancy
        const vacancyMap: Record<
          string,
          { title: string; association_type: string; count: number }
        > = {}
        for (const row of historyData ?? []) {
          const vid = row.job_opening_id
          const vacancy = (row.job_openings_kpi as unknown) as
            | { id: string; title: string; is_vacante_principal: boolean }
            | null
          if (!vacancy || vacancy.title === 'BBDD') continue
          if (!vacancyMap[vid]) {
            vacancyMap[vid] = {
              title: vacancy.title,
              association_type: row.association_type,
              count: 0,
            }
          }
          vacancyMap[vid].count++
        }

        associatedVacancies = Object.entries(vacancyMap).map(([vid, info]) => ({
          vacancy_id: vid,
          title: info.title,
          association_type: info.association_type,
          candidate_count: info.count,
        }))

        associatedVacancies.sort((a, b) => b.candidate_count - a.candidate_count)
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                promotion: promoData,
                students: {
                  total: (studentsData ?? []).length,
                  by_status: statusCounts,
                  error: studentsError?.message,
                },
                associated_vacancies: associatedVacancies,
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
