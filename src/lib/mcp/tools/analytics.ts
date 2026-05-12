import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpRpc } from '../supabase'

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    'get_weekly_cv_trend',
    'Get the weekly CV submission trend. Can be filtered by specific vacancy. Returns data grouped by week, ordered chronologically.',
    {
      weeks: z.number().int().min(1).max(52).default(8).optional().describe('Number of weeks to look back (default 8, max 52)'),
      vacancy_id: z.string().optional().describe('Filter by specific vacancy UUID. If omitted, returns aggregated data for all vacancies.'),
    },
    async ({ weeks = 8, vacancy_id }) => {
      const { data, error } = await mcpRpc('mcp_get_weekly_cv_trend', {
        p_weeks: weeks ?? 8,
        p_vacancy_id: vacancy_id,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_kpi_metrics',
    'Get KPI metrics (success rate, discard rate, candidates, hired) for one or all principal vacancies.',
    {
      vacancy_id: z.string().optional().describe('If provided, returns metrics only for that vacancy. Otherwise returns metrics for all principal vacancies.'),
    },
    async ({ vacancy_id }) => {
      const { data, error } = await mcpRpc('mcp_get_kpi_metrics', {
        p_vacancy_id: vacancy_id,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
