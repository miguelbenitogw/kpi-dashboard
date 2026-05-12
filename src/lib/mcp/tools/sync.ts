import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpRpc } from '../supabase'

export function registerSyncTools(server: McpServer) {
  server.tool(
    'trigger_sync',
    'Trigger a data synchronization phase for the KPI Dashboard. Calls the internal sync-all API endpoint.',
    {
      phase: z
        .enum(['zoho', 'madre', 'social', 'cvs', 'colocacion'])
        .describe('The sync phase to trigger: zoho (Zoho Recruit), madre (Excel Madre sheets), social (social media), cvs (CV weekly counts), colocacion (placement data)'),
    },
    async ({ phase }) => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const syncApiKey = process.env.SYNC_API_KEY

      if (!syncApiKey) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'SYNC_API_KEY environment variable is not configured.' }) }] }
      }

      let response: Response
      try {
        response = await fetch(`${appUrl}/api/admin/sync-all?phase=${phase}`, {
          method: 'POST',
          headers: { 'x-api-key': syncApiKey, 'Content-Type': 'application/json' },
        })
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: `Failed to reach sync endpoint: ${err instanceof Error ? err.message : String(err)}`,
              phase,
              url: `${appUrl}/api/admin/sync-all?phase=${phase}`,
            }),
          }],
        }
      }

      let responseBody: unknown
      try {
        responseBody = await response.json()
      } catch {
        responseBody = { raw: await response.text().catch(() => '(unreadable)') }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ phase, status: response.status, ok: response.ok, response: responseBody }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'get_sync_logs',
    'Get the most recent sync operation logs from the KPI Dashboard. Returns phase, status, inserted counts, and any errors.',
    {
      limit: z.number().int().min(1).max(50).default(10).optional().describe('Number of log entries to return (default 10, max 50)'),
    },
    async ({ limit = 10 }) => {
      const { data, error } = await mcpRpc('mcp_get_sync_logs', {
        p_lim: limit ?? 10,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
