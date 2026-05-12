import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpRpc } from '../supabase'

export function registerCandidateTools(server: McpServer) {
  server.tool(
    'search_candidates',
    'Search candidates in the KPI system. Filter by promotion name or current status. Returns id, nombre_completo, promocion_nombre, estado_actual, pais_destino.',
    {
      promo: z.string().optional().describe('Filter by promotion name (partial match)'),
      status: z.string().optional().describe('Filter by current status (e.g. "Dropout", "Graduado", "Formación")'),
      limit: z.number().int().min(1).max(100).default(20).optional().describe('Number of results to return (default 20, max 100)'),
    },
    async ({ promo, status, limit = 20 }) => {
      const { data, error } = await mcpRpc('mcp_search_candidates', {
        p_promo: promo,
        p_status: status,
        p_lim: limit ?? 20,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_candidate_history',
    'Get the job/vacancy history for a specific candidate. Returns all vacancies associated with the candidate, including the association type and current status.',
    {
      candidate_id: z.string().describe('The candidate UUID from candidates_kpi.id'),
    },
    async ({ candidate_id }) => {
      const { data, error } = await mcpRpc('mcp_get_candidate_history', {
        p_candidate_id: candidate_id,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
