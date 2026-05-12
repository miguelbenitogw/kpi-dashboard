import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpSupabase } from '../supabase.js'

const FORBIDDEN_PATTERN = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b/i

export function registerDatabaseTools(server: McpServer) {
  server.tool(
    'query_database',
    'Execute a SELECT-only SQL query against the KPI database. Returns up to 200 rows. Use schema://tables resource to understand available tables and columns.',
    {
      sql: z.string().describe('The SQL SELECT query to execute'),
      description: z
        .string()
        .optional()
        .describe('Optional human-readable description of what this query does'),
    },
    async ({ sql, description }) => {
      if (FORBIDDEN_PATTERN.test(sql)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error:
                    'Query rejected: only SELECT statements are allowed. Detected forbidden keyword.',
                  sql,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // Enforce row limit
      const stripped = sql.trimEnd().replace(/;?\s*$/, '')
      const finalSql = /\bLIMIT\b/i.test(stripped)
        ? stripped
        : `${stripped} LIMIT 200`

      const { data, error } = await mcpSupabase.rpc('execute_sql', {
        query: finalSql,
      } as never)

      if (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: error.message,
                  hint: error.hint,
                  sql: finalSql,
                  description,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      const rows = Array.isArray(data) ? data : []
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                rows: rows.slice(0, 200),
                row_count: Math.min(rows.length, 200),
                sql: finalSql,
                description,
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
