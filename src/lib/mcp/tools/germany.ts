import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpRpc } from '../supabase.js'

export function registerGermanyTools(server: McpServer) {
  server.tool(
    'get_germany_pipeline',
    'Get the Germany program candidate pipeline. Returns candidates grouped by stage with counts and individual listings.',
    {
      stage: z.string().optional().describe('Filter by specific stage name (partial match, case-insensitive). If omitted, returns all stages.'),
    },
    async ({ stage }) => {
      const { data, error } = await mcpRpc('mcp_get_germany_pipeline', {
        p_stage: stage,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
