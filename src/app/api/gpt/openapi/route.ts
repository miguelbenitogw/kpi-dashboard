export function GET() {
  const BASE = 'https://kpi-dashboard-hazel-seven.vercel.app/api/gpt'

  const spec = {
    openapi: '3.0.2',
    info: {
      title: 'GlobalWorking KPI API',
      description:
        'KPI data API for GlobalWorking — recruitment pipeline covering atracción, formación and colocación for nursing candidates destined to Norway, Belgium and Germany.',
      version: '1.0.0',
    },
    servers: [{ url: BASE }],
    paths: {
      '/dashboard-summary': {
        get: {
          operationId: 'getDashboardSummary',
          summary: 'High-level KPI overview',
          description:
            'Returns active candidates in training, open principal vacancies, active promotions, and CVs received this week.',
          responses: { '200': { description: 'Dashboard KPI summary' } },
        },
      },
      '/search-candidates': {
        get: {
          operationId: 'searchCandidates',
          summary: 'Search candidates',
          description:
            'Filter candidates by promotion name or current status. Returns id, full_name, promocion_nombre, current_status, pais_destino.',
          parameters: [
            {
              name: 'promo',
              in: 'query',
              description: 'Promotion name (partial match)',
              schema: { type: 'string' },
            },
            {
              name: 'status',
              in: 'query',
              description:
                'Current status, e.g. "Dropout", "Graduado", "Formación"',
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Max results (default 20, max 100)',
              schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
            },
          ],
          responses: { '200': { description: 'List of candidates' } },
        },
      },
      '/candidate-history': {
        get: {
          operationId: 'getCandidateHistory',
          summary: 'Get candidate job history',
          description:
            'All vacancies a candidate has been associated with, including status and association type.',
          parameters: [
            {
              name: 'candidate_id',
              in: 'query',
              required: true,
              description: 'Candidate UUID from candidates_kpi.id',
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'Candidate job history' } },
        },
      },
      '/search-vacancies': {
        get: {
          operationId: 'searchVacancies',
          summary: 'Search job vacancies',
          description:
            'Search job openings. BBDD vacancies are always excluded. Returns id, title, tipo_profesional, is_vacante_principal, total_candidates, hired_count.',
          parameters: [
            {
              name: 'title',
              in: 'query',
              description: 'Vacancy title (partial match, case-insensitive)',
              schema: { type: 'string' },
            },
            {
              name: 'is_principal',
              in: 'query',
              description:
                'true = only principal vacancies, false = only non-principal',
              schema: { type: 'boolean' },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Max results (default 20, max 100)',
              schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
            },
          ],
          responses: { '200': { description: 'List of vacancies' } },
        },
      },
      '/vacancy-detail': {
        get: {
          operationId: 'getVacancyDetail',
          summary: 'Get vacancy details',
          description:
            'Full data for one vacancy: base info, status breakdown, weekly CV trend, and GW tags.',
          parameters: [
            {
              name: 'vacancy_id',
              in: 'query',
              required: true,
              description: 'Vacancy UUID from job_openings_kpi.id',
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'Vacancy details' } },
        },
      },
      '/promotion-list': {
        get: {
          operationId: 'getPromotionList',
          summary: 'List training promotions',
          description:
            'Returns all training promotions. active_only defaults to true.',
          parameters: [
            {
              name: 'active_only',
              in: 'query',
              description:
                'If true (default), only return promotions with fecha_fin > today or null',
              schema: { type: 'boolean', default: true },
            },
          ],
          responses: { '200': { description: 'List of promotions' } },
        },
      },
      '/promotion-detail': {
        get: {
          operationId: 'getPromotionDetail',
          summary: 'Get promotion details',
          description:
            'Full data for one promotion: base info, student count by status, and associated vacancies. Provide promo_id or promo_nombre.',
          parameters: [
            {
              name: 'promo_id',
              in: 'query',
              description: 'Promotion UUID from promotions_kpi.id',
              schema: { type: 'string' },
            },
            {
              name: 'promo_nombre',
              in: 'query',
              description: 'Promotion name (partial match)',
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'Promotion details' } },
        },
      },
      '/cv-trend': {
        get: {
          operationId: 'getCvTrend',
          summary: 'Weekly CV submission trend',
          description:
            'CV submission counts grouped by week, ordered chronologically. Can be filtered to one vacancy.',
          parameters: [
            {
              name: 'weeks',
              in: 'query',
              description: 'Weeks to look back (default 8, max 52)',
              schema: {
                type: 'integer',
                default: 8,
                minimum: 1,
                maximum: 52,
              },
            },
            {
              name: 'vacancy_id',
              in: 'query',
              description: 'Filter by vacancy UUID (omit for all vacancies)',
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'Weekly CV trend data' } },
        },
      },
      '/kpi-metrics': {
        get: {
          operationId: 'getKpiMetrics',
          summary: 'Get KPI metrics',
          description:
            'Success rate, discard rate, total candidates and hired counts. If vacancy_id is omitted, returns metrics for all principal vacancies.',
          parameters: [
            {
              name: 'vacancy_id',
              in: 'query',
              description: 'Vacancy UUID (omit for all principal vacancies)',
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'KPI metrics' } },
        },
      },
      '/germany-pipeline': {
        get: {
          operationId: 'getGermanyPipeline',
          summary: 'Germany program pipeline',
          description:
            'Candidate pipeline for the Germany program, grouped by stage with counts and individual listings.',
          parameters: [
            {
              name: 'stage',
              in: 'query',
              description:
                'Filter by stage name (partial match, case-insensitive)',
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'Germany pipeline data' } },
        },
      },
      '/sync-logs': {
        get: {
          operationId: 'getSyncLogs',
          summary: 'Recent sync logs',
          description:
            'Most recent data sync operation logs: phase, status, inserted counts, and errors.',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'Number of entries (default 10, max 50)',
              schema: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
            },
          ],
          responses: { '200': { description: 'Sync log entries' } },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Use the MCP_API_KEY value as the Bearer token',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  }

  return Response.json(spec, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  })
}
