import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mcpRpc } from '../supabase'

export function registerDashboardTools(server: McpServer) {
  server.tool(
    'get_dashboard_summary',
    'Returns a high-level summary of the KPI Dashboard: active candidates in training, open principal vacancies, active promotions, and CVs received this week.',
    {},
    async () => {
      const { data, error } = await mcpRpc('mcp_dashboard_summary')
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
