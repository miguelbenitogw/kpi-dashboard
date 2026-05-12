import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpRpc } from '../supabase.js'

export function registerVacancyTools(server: McpServer) {
  server.tool(
    'search_vacancies',
    'Search job vacancies (ofertas de trabajo) in the KPI system. Always excludes BBDD vacancies. Returns id, title, tipo_profesional, is_vacante_principal, total_candidates, hired_count.',
    {
      title: z.string().optional().describe('Filter by title (partial match, case-insensitive)'),
      is_principal: z.boolean().optional().describe('Filter to only principal vacancies (true) or only non-principal (false)'),
      limit: z.number().int().min(1).max(100).default(20).optional().describe('Number of results to return (default 20, max 100)'),
    },
    async ({ title, is_principal, limit = 20 }) => {
      const { data, error } = await mcpRpc('mcp_search_vacancies', {
        p_title: title,
        p_is_principal: is_principal,
        p_lim: limit ?? 20,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_vacancy_detail',
    'Get detailed information for a specific vacancy: base data, status breakdown, CV trend, and GW tags.',
    {
      vacancy_id: z.string().describe('The vacancy UUID from job_openings_kpi.id'),
    },
    async ({ vacancy_id }) => {
      const { data, error } = await mcpRpc('mcp_get_vacancy_detail', {
        p_vacancy_id: vacancy_id,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
