import { NextRequest } from 'next/server'
import { mcpRpc } from '@/lib/mcp/supabase'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getApiKey(req: NextRequest): string | null {
  const url = new URL(req.url)
  return (
    req.headers.get('x-api-key') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    url.searchParams.get('key') ??
    null
  )
}

// ─── Tool definitions (returned on tools/list) ────────────────────────────────

const TOOLS = [
  {
    name: 'get_dashboard_summary',
    description:
      'Returns a high-level summary of the KPI Dashboard: active candidates in training, open principal vacancies, active promotions, and CVs received this week.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_candidates',
    description:
      'Search candidates in the KPI system. Filter by promotion name or current status. Returns id, full_name, promocion_nombre, current_status, pais_destino.',
    inputSchema: {
      type: 'object',
      properties: {
        promo: { type: 'string', description: 'Filter by promotion name (partial match)' },
        status: {
          type: 'string',
          description: 'Filter by current status (e.g. "Dropout", "Graduado", "Formación")',
        },
        limit: {
          type: 'integer',
          description: 'Number of results to return (default 20, max 100)',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },
  {
    name: 'get_candidate_history',
    description:
      'Get the job/vacancy history for a specific candidate. Returns all vacancies associated with the candidate.',
    inputSchema: {
      type: 'object',
      properties: {
        candidate_id: {
          type: 'string',
          description: 'The candidate UUID from candidates_kpi.id',
        },
      },
      required: ['candidate_id'],
    },
  },
  {
    name: 'search_vacancies',
    description:
      'Search job vacancies. Always excludes BBDD vacancies. Returns id, title, tipo_profesional, is_vacante_principal, total_candidates, hired_count.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Filter by title (partial match, case-insensitive)' },
        is_principal: {
          type: 'boolean',
          description: 'true = only principal vacancies, false = only non-principal',
        },
        limit: {
          type: 'integer',
          description: 'Number of results to return (default 20, max 100)',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },
  {
    name: 'get_vacancy_detail',
    description:
      'Get detailed information for a specific vacancy: base data, status breakdown, CV trend, and GW tags.',
    inputSchema: {
      type: 'object',
      properties: {
        vacancy_id: {
          type: 'string',
          description: 'The vacancy UUID from job_openings_kpi.id',
        },
      },
      required: ['vacancy_id'],
    },
  },
  {
    name: 'get_promotion_list',
    description:
      'Get the list of training promotions. By default returns only active promotions (fecha_fin > today or null).',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: {
          type: 'boolean',
          description: 'If true (default), only return currently active promotions',
          default: true,
        },
      },
    },
  },
  {
    name: 'get_promotion_detail',
    description:
      'Get detailed information for a specific promotion: base data, student count by status, and associated vacancies.',
    inputSchema: {
      type: 'object',
      properties: {
        promo_id: {
          type: 'string',
          description: 'The promotion UUID from promotions_kpi.id',
        },
        promo_nombre: {
          type: 'string',
          description: 'The promotion name (partial match). Used if promo_id is not provided.',
        },
      },
    },
  },
  {
    name: 'get_weekly_cv_trend',
    description:
      'Get the weekly CV submission trend. Can be filtered by specific vacancy. Returns data grouped by week, ordered chronologically.',
    inputSchema: {
      type: 'object',
      properties: {
        weeks: {
          type: 'integer',
          description: 'Number of weeks to look back (default 8, max 52)',
          default: 8,
          minimum: 1,
          maximum: 52,
        },
        vacancy_id: {
          type: 'string',
          description: 'Filter by specific vacancy UUID. If omitted, returns aggregated data for all vacancies.',
        },
      },
    },
  },
  {
    name: 'get_kpi_metrics',
    description:
      'Get KPI metrics (success rate, discard rate, candidates, hired) for one or all principal vacancies.',
    inputSchema: {
      type: 'object',
      properties: {
        vacancy_id: {
          type: 'string',
          description:
            'If provided, returns metrics only for that vacancy. Otherwise returns metrics for all principal vacancies.',
        },
      },
    },
  },
  {
    name: 'get_germany_pipeline',
    description:
      'Get the Germany program candidate pipeline. Returns candidates grouped by stage with counts and individual listings.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          description: 'Filter by specific stage name (partial match, case-insensitive). If omitted, returns all stages.',
        },
      },
    },
  },
  {
    name: 'get_sync_logs',
    description:
      'Get the most recent sync operation logs from the KPI Dashboard. Returns phase, status, inserted counts, and any errors.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Number of log entries to return (default 10, max 50)',
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
    },
  },
  {
    name: 'list_mcp_functions',
    description:
      'Lists all available controlled SQL functions that can be called via the other tools. Use this to understand what data is available.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'trigger_sync',
    description:
      'Trigger a data synchronization phase for the KPI Dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: ['zoho', 'madre', 'social', 'cvs', 'colocacion'],
          description: 'The sync phase to trigger',
        },
      },
      required: ['phase'],
    },
  },
]

// ─── Tool executor ────────────────────────────────────────────────────────────

async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ data: unknown; error: string | null }> {
  switch (name) {
    case 'get_dashboard_summary':
      return mcpRpc('mcp_dashboard_summary')

    case 'search_candidates':
      return mcpRpc('mcp_search_candidates', {
        p_promo: args.promo ?? null,
        p_status: args.status ?? null,
        p_lim: args.limit ?? 20,
      })

    case 'get_candidate_history':
      return mcpRpc('mcp_get_candidate_history', {
        p_candidate_id: args.candidate_id,
      })

    case 'search_vacancies':
      return mcpRpc('mcp_search_vacancies', {
        p_title: args.title ?? null,
        p_is_principal: args.is_principal ?? null,
        p_lim: args.limit ?? 20,
      })

    case 'get_vacancy_detail':
      return mcpRpc('mcp_get_vacancy_detail', {
        p_vacancy_id: args.vacancy_id,
      })

    case 'get_promotion_list':
      return mcpRpc('mcp_get_promotion_list', {
        p_active_only: args.active_only ?? true,
      })

    case 'get_promotion_detail':
      return mcpRpc('mcp_get_promotion_detail', {
        p_promo_id: args.promo_id ?? null,
        p_promo_nombre: args.promo_nombre ?? null,
      })

    case 'get_weekly_cv_trend':
      return mcpRpc('mcp_get_weekly_cv_trend', {
        p_weeks: args.weeks ?? 8,
        p_vacancy_id: args.vacancy_id ?? null,
      })

    case 'get_kpi_metrics':
      return mcpRpc('mcp_get_kpi_metrics', {
        p_vacancy_id: args.vacancy_id ?? null,
      })

    case 'get_germany_pipeline':
      return mcpRpc('mcp_get_germany_pipeline', {
        p_stage: args.stage ?? null,
      })

    case 'get_sync_logs':
      return mcpRpc('mcp_get_sync_logs', {
        p_lim: args.limit ?? 10,
      })

    case 'list_mcp_functions':
      return {
        data: {
          functions: [
            'mcp_dashboard_summary() → overview KPIs',
            'mcp_search_candidates(promo, status, limit) → filter candidates',
            'mcp_get_candidate_history(candidate_id) → job history for one candidate',
            'mcp_search_vacancies(title, is_principal, limit) → filter vacancies',
            'mcp_get_vacancy_detail(vacancy_id) → full vacancy data + status + weekly CVs',
            'mcp_get_promotion_list(active_only) → all promotions',
            'mcp_get_promotion_detail(promo_id, promo_nombre) → full promotion data + students',
            'mcp_get_weekly_cv_trend(weeks, vacancy_id) → CV trend over time',
            'mcp_get_kpi_metrics(vacancy_id) → success/discard rates',
            'mcp_get_germany_pipeline(stage) → Germany program pipeline',
            'mcp_get_sync_logs(limit) → recent sync history',
          ],
          note: 'All functions use SECURITY DEFINER with anon key — tables are not directly accessible.',
        },
        error: null,
      }

    case 'trigger_sync': {
      const phase = args.phase as string
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kpi-dashboard-hazel-seven.vercel.app'
      const res = await fetch(`${base}/api/admin/sync-all?phase=${phase}`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '' },
      })
      if (!res.ok) return { data: null, error: `Sync failed: ${res.status}` }
      const json = await res.json()
      return { data: json, error: null }
    }

    default:
      return { data: null, error: `Unknown tool: ${name}` }
  }
}

// ─── JSON-RPC dispatcher ──────────────────────────────────────────────────────

async function handleMcpRequest(req: NextRequest): Promise<Response> {
  const key = getApiKey(req)
  if (!key || key !== process.env.MCP_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // GET requests: some clients open a GET to establish an SSE channel.
  // We don't need persistent SSE — return 200 so they don't error out.
  if (req.method === 'GET') {
    return new Response(null, { status: 200 })
  }

  let body: {
    jsonrpc?: string
    id?: unknown
    method?: string
    params?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return Response.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    })
  }

  const { id = null, method = '', params = {} } = body

  switch (method) {
    case 'initialize':
      return Response.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'globalworking-kpi', version: '1.0.0' },
        },
      })

    case 'notifications/initialized':
      return new Response(null, { status: 204 })

    case 'ping':
      return Response.json({ jsonrpc: '2.0', id, result: {} })

    case 'tools/list':
      return Response.json({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      })

    case 'tools/call': {
      const toolName = (params.name as string | undefined) ?? ''
      const toolArgs = (params.arguments as Record<string, unknown> | undefined) ?? {}
      const { data, error } = await callTool(toolName, toolArgs)
      return Response.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: error
                ? JSON.stringify({ error }, null, 2)
                : JSON.stringify(data, null, 2),
            },
          ],
          isError: !!error,
        },
      })
    }

    default:
      return Response.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      })
  }
}

export const POST = handleMcpRequest
export const GET = handleMcpRequest
export const DELETE = handleMcpRequest
