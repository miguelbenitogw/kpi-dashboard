import { NextRequest } from 'next/server'
import { mcpRpc } from '@/lib/mcp/supabase'

function checkAuth(req: NextRequest): boolean {
  const url = new URL(req.url)
  const key =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.headers.get('x-api-key') ??
    url.searchParams.get('key')
  return !!key && key === process.env.MCP_API_KEY
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
) {
  if (!checkAuth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tool } = await params
  const sp = new URL(req.url).searchParams

  switch (tool) {
    case 'dashboard-summary': {
      const { data, error } = await mcpRpc('mcp_dashboard_summary')
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'search-candidates': {
      const { data, error } = await mcpRpc('mcp_search_candidates', {
        p_promo: sp.get('promo') ?? null,
        p_status: sp.get('status') ?? null,
        p_lim: sp.get('limit') ? parseInt(sp.get('limit')!) : 20,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'candidate-history': {
      const candidate_id = sp.get('candidate_id')
      if (!candidate_id)
        return Response.json({ error: 'candidate_id is required' }, { status: 400 })
      const { data, error } = await mcpRpc('mcp_get_candidate_history', {
        p_candidate_id: candidate_id,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'search-vacancies': {
      const raw = sp.get('is_principal')
      const { data, error } = await mcpRpc('mcp_search_vacancies', {
        p_title: sp.get('title') ?? null,
        p_is_principal: raw === null ? null : raw === 'true',
        p_lim: sp.get('limit') ? parseInt(sp.get('limit')!) : 20,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'vacancy-detail': {
      const vacancy_id = sp.get('vacancy_id')
      if (!vacancy_id)
        return Response.json({ error: 'vacancy_id is required' }, { status: 400 })
      const { data, error } = await mcpRpc('mcp_get_vacancy_detail', {
        p_vacancy_id: vacancy_id,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'promotion-list': {
      const { data, error } = await mcpRpc('mcp_get_promotion_list', {
        p_active_only: sp.get('active_only') !== 'false',
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'promotion-detail': {
      const promo_id = sp.get('promo_id') ?? null
      const promo_nombre = sp.get('promo_nombre') ?? null
      if (!promo_id && !promo_nombre)
        return Response.json(
          { error: 'promo_id or promo_nombre is required' },
          { status: 400 }
        )
      const { data, error } = await mcpRpc('mcp_get_promotion_detail', {
        p_promo_id: promo_id,
        p_promo_nombre: promo_nombre,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'cv-trend': {
      const { data, error } = await mcpRpc('mcp_get_weekly_cv_trend', {
        p_weeks: sp.get('weeks') ? parseInt(sp.get('weeks')!) : 8,
        p_vacancy_id: sp.get('vacancy_id') ?? null,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'kpi-metrics': {
      const { data, error } = await mcpRpc('mcp_get_kpi_metrics', {
        p_vacancy_id: sp.get('vacancy_id') ?? null,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'germany-pipeline': {
      const { data, error } = await mcpRpc('mcp_get_germany_pipeline', {
        p_stage: sp.get('stage') ?? null,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    case 'sync-logs': {
      const { data, error } = await mcpRpc('mcp_get_sync_logs', {
        p_lim: sp.get('limit') ? parseInt(sp.get('limit')!) : 10,
      })
      if (error) return Response.json({ error }, { status: 500 })
      return Response.json(data)
    }

    default:
      return Response.json({ error: `Unknown tool: ${tool}` }, { status: 404 })
  }
}
