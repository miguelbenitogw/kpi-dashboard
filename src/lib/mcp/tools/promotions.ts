import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpRpc } from '../supabase.js'

export function registerPromotionTools(server: McpServer) {
  server.tool(
    'get_promotion_list',
    'Get the list of promotions (promociones de formación). By default returns only active promotions.',
    {
      active_only: z.boolean().default(true).optional().describe('If true (default), only return promotions that are currently active (fecha_fin > today or null)'),
    },
    async ({ active_only = true }) => {
      const { data, error } = await mcpRpc('mcp_get_promotion_list', {
        p_active_only: active_only,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_promotion_detail',
    'Get detailed information for a specific promotion: base data, student count by status, and associated vacancies.',
    {
      promo_id: z.string().optional().describe('The promotion UUID from promotions_kpi.id'),
      promo_nombre: z.string().optional().describe('The promotion name (partial match). Used if promo_id is not provided.'),
    },
    async ({ promo_id, promo_nombre }) => {
      if (!promo_id && !promo_nombre) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Either promo_id or promo_nombre must be provided.' }) }] }
      }
      const { data, error } = await mcpRpc('mcp_get_promotion_detail', {
        p_promo_id: promo_id,
        p_promo_nombre: promo_nombre,
      })
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ error }) }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
