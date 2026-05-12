import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerDashboardTools } from './tools/dashboard.js'
import { registerCandidateTools } from './tools/candidates.js'
import { registerVacancyTools } from './tools/vacancies.js'
import { registerPromotionTools } from './tools/promotions.js'
import { registerAnalyticsTools } from './tools/analytics.js'
import { registerGermanyTools } from './tools/germany.js'
import { registerDatabaseTools } from './tools/database.js'
import { registerSyncTools } from './tools/sync.js'
import { registerSchemaResources } from './resources/schema.js'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'kpi-dashboard',
    version: '1.0.0',
  })

  // Register tools
  registerDashboardTools(server)
  registerCandidateTools(server)
  registerVacancyTools(server)
  registerPromotionTools(server)
  registerAnalyticsTools(server)
  registerGermanyTools(server)
  registerDatabaseTools(server)
  registerSyncTools(server)

  // Register resources
  registerSchemaResources(server)

  return server
}
