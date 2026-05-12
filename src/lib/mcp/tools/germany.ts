import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpSupabase } from '../supabase.js'

export function registerGermanyTools(server: McpServer) {
  server.tool(
    'get_germany_pipeline',
    'Get the Germany program candidate pipeline. Returns candidates grouped by stage with counts and individual listings.',
    {
      stage: z
        .string()
        .optional()
        .describe('Filter by specific stage name (partial match, case-insensitive). If omitted, returns all stages.'),
    },
    async ({ stage }) => {
      let query = mcpSupabase
        .from('germany_candidates_kpi')
        .select('id, nombre_completo, stage, fecha_inicio, pais_destino')
        .order('stage', { ascending: true })
        .order('nombre_completo', { ascending: true })

      if (stage) {
        query = query.ilike('stage', `%${stage}%`)
      }

      const { data, error } = await query

      if (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: error.message }, null, 2),
            },
          ],
        }
      }

      const candidates = data ?? []

      // Group by stage
      const stageMap: Record<
        string,
        { count: number; candidates: typeof candidates }
      > = {}

      for (const candidate of candidates) {
        const key = candidate.stage ?? 'Sin etapa'
        if (!stageMap[key]) {
          stageMap[key] = { count: 0, candidates: [] }
        }
        stageMap[key].count++
        stageMap[key].candidates.push(candidate)
      }

      const pipeline = Object.entries(stageMap).map(([stage_name, info]) => ({
        stage: stage_name,
        count: info.count,
        candidates: info.candidates,
      }))

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                total: candidates.length,
                filter: stage ? { stage } : 'all stages',
                pipeline,
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
