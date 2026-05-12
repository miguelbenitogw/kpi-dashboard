import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerDatabaseTools(server: McpServer) {
  server.tool(
    'list_mcp_functions',
    'Lists all available controlled SQL functions that can be called via the other tools. Use this to understand what data is available.',
    {},
    async () => {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
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
          }, null, 2),
        }],
      }
    }
  )
}
