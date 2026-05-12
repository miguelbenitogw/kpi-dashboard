import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerDashboardTools } from './tools/dashboard'
import { registerCandidateTools } from './tools/candidates'
import { registerVacancyTools } from './tools/vacancies'
import { registerPromotionTools } from './tools/promotions'
import { registerAnalyticsTools } from './tools/analytics'
import { registerGermanyTools } from './tools/germany'
import { registerDatabaseTools } from './tools/database'
import { registerSyncTools } from './tools/sync'
import { registerSchemaResources } from './resources/schema'

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
