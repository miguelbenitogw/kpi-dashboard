import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpSupabase } from '../supabase.js'

export function registerCandidateTools(server: McpServer) {
  server.tool(
    'search_candidates',
    'Search candidates in the KPI system. Filter by promotion name or current status. Returns id, nombre_completo, promocion_nombre, estado_actual, pais_destino.',
    {
      promo: z.string().optional().describe('Filter by promotion name (partial match)'),
      status: z.string().optional().describe('Filter by current status (e.g. "Dropout", "Graduado", "Formación")'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .optional()
        .describe('Number of results to return (default 20, max 100)'),
    },
    async ({ promo, status, limit = 20 }) => {
      const clampedLimit = Math.min(limit ?? 20, 100)

      let query = mcpSupabase
        .from('candidates_kpi')
        .select('id, nombre_completo, promocion_nombre, estado_actual, pais_destino, fecha_ingreso_formacion, contratado_en')
        .limit(clampedLimit)

      if (promo) {
        query = query.ilike('promocion_nombre', `%${promo}%`)
      }

      if (status) {
        query = query.ilike('estado_actual', `%${status}%`)
      }

      const { data, error, count } = await query

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
                candidates: data ?? [],
                returned: (data ?? []).length,
                filters: { promo, status, limit: clampedLimit },
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
    'get_candidate_history',
    'Get the job/vacancy history for a specific candidate. Returns all vacancies associated with the candidate, including the association type (atraccion or formacion) and current status.',
    {
      candidate_id: z.string().describe('The candidate UUID from candidates_kpi.id'),
    },
    async ({ candidate_id }) => {
      const { data, error } = await mcpSupabase
        .from('candidate_job_history_kpi')
        .select(
          `
          job_opening_id,
          association_type,
          current_status,
          job_openings_kpi (
            id,
            title,
            tipo_profesional,
            is_vacante_principal,
            zoho_job_number
          )
        `
        )
        .eq('candidate_id', candidate_id)

      if (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: error.message, candidate_id }, null, 2),
            },
          ],
        }
      }

      // Also fetch the candidate basic info
      const { data: candidateData } = await mcpSupabase
        .from('candidates_kpi')
        .select('id, nombre_completo, promocion_nombre, estado_actual, pais_destino')
        .eq('id', candidate_id)
        .single()

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                candidate: candidateData ?? null,
                history: (data ?? []).map((row) => ({
                  job_opening_id: row.job_opening_id,
                  association_type: row.association_type,
                  current_status: row.current_status,
                  vacancy: row.job_openings_kpi,
                })),
                total: (data ?? []).length,
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
