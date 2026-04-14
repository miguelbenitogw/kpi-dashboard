import { type NextRequest } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../sync/middleware'
import {
  searchCandidates,
  searchJobOpenings,
  getStatusBreakdown,
  getCandidateDetail,
  getAggregatedStats,
} from '@/lib/zoho/direct-queries'

// ─── OpenAI tool definitions ───────────────────────────────────────────────

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_promo_status_breakdown',
      description:
        'Obtiene el desglose de candidatos por estado para una promoción/vacante específica. Si no se provee job_opening_id, devuelve estadísticas globales.',
      parameters: {
        type: 'object',
        properties: {
          job_opening_id: {
            type: 'string',
            description: 'ID de la vacante/promoción en Zoho Recruit',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_candidates',
      description:
        'Busca candidatos por nombre, estado o vacante. Devuelve lista de candidatos con sus datos principales.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nombre o parte del nombre del candidato',
          },
          status: {
            type: 'string',
            description:
              'Estado del candidato, ej: Hired, In Training, First Call, Associated, etc.',
          },
          job_opening_id: {
            type: 'string',
            description: 'Filtrar por ID de vacante',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_job_openings',
      description:
        'Lista las vacantes/promociones disponibles en Zoho Recruit.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description:
              'Filtrar por estado: In-progress, Open, Filled, Cancelled, On Hold',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_hiring_stats',
      description:
        'Obtiene estadísticas de contratación y conversión del funnel. Puede ser global o para una vacante específica.',
      parameters: {
        type: 'object',
        properties: {
          job_opening_id: {
            type: 'string',
            description: 'ID de la vacante (opcional, si no se da es global)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_candidate_detail',
      description:
        'Obtiene la ficha completa de un candidato específico por su ID.',
      parameters: {
        type: 'object',
        properties: {
          candidate_id: {
            type: 'string',
            description: 'ID del candidato en Zoho Recruit',
          },
        },
        required: ['candidate_id'],
      },
    },
  },
]

// ─── Tool execution ────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, string>
): Promise<unknown> {
  switch (name) {
    case 'get_promo_status_breakdown': {
      if (args.job_opening_id) {
        return getStatusBreakdown(args.job_opening_id)
      }
      return getAggregatedStats()
    }

    case 'search_candidates': {
      const parts: string[] = []
      if (args.name) {
        parts.push(`(Full_Name:starts_with:${args.name})`)
      }
      if (args.status) {
        parts.push(`(Candidate_Status:equals:${args.status})`)
      }
      if (args.job_opening_id) {
        parts.push(`(Job_Opening:equals:${args.job_opening_id})`)
      }
      const criteria = parts.length > 0 ? parts.join(' and ') : undefined
      const result = await searchCandidates({ criteria, per_page: 50 })
      return {
        total: result.pagination.count,
        candidates: result.data.slice(0, 20).map((c) => ({
          id: c.id,
          name: c.full_name,
          status: c.current_status,
          owner: c.owner,
          source: c.source,
          nationality: c.nationality,
          created: c.created_time,
        })),
        note:
          result.data.length > 20
            ? `Mostrando 20 de ${result.data.length} resultados`
            : undefined,
      }
    }

    case 'get_job_openings': {
      const criteria = args.status
        ? `(Job_Opening_Status:equals:${args.status})`
        : undefined
      const result = await searchJobOpenings({ criteria, per_page: 100 })
      return {
        total: result.pagination.count,
        job_openings: result.data.map((j) => ({
          id: j.id,
          title: j.title,
          status: j.status,
          client: j.client_name,
          owner: j.owner,
          total_candidates: j.total_candidates,
          hired: j.hired_count,
          date_opened: j.date_opened,
        })),
      }
    }

    case 'get_hiring_stats': {
      return getAggregatedStats(args.job_opening_id)
    }

    case 'get_candidate_detail': {
      return getCandidateDetail(args.candidate_id)
    }

    default:
      return { error: `Tool desconocida: ${name}` }
  }
}

// ─── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente analista de reclutamiento para Global Working, empresa especializada en la contratación de enfermeros y profesionales de salud para Noruega y Alemania.

Tenés acceso a datos en tiempo real de Zoho Recruit mediante herramientas (tools). Cuando el usuario haga preguntas sobre candidatos, vacantes, estadísticas o el pipeline de contratación, SIEMPRE usá las herramientas disponibles para consultar datos actualizados.

Contexto del negocio:
- Global Working recluta enfermeros hispanohablantes para trabajar en Noruega y Alemania
- Las "promos" son las promociones/vacantes activas (Job Openings en Zoho)
- El pipeline va desde "New" / "Associated" hasta "Hired" pasando por múltiples etapas
- Los estados terminales incluyen: Hired, Rejected, Offer-Declined, Expelled, etc.
- Los idiomas clave son: español (nativo), inglés, alemán, noruego

Instrucciones:
- Respondé siempre en español rioplatense, de forma clara y directa
- Cuando mostrés datos numéricos, usá formato de tabla o lista para mayor claridad
- Si no encontrás datos relevantes, decilo claramente
- Ante preguntas ambiguas, aclarate antes de consultar
- Cuando consultés herramientas, no las menciones explícitamente a menos que sea relevante
- Sé conciso pero completo en tus respuestas`

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return Response.json(
      { error: 'OPENAI_API_KEY no configurada' },
      { status: 500 }
    )
  }

  let body: { messages?: unknown[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const messages = body.messages ?? []

  // Agentic loop: call OpenAI, handle tool calls, stream final response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Build message history with system prompt
        const chatMessages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ]

        // Agentic loop – handle tool calls until we get a final text response
        let continueLoop = true
        while (continueLoop) {
          const openaiRes = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: chatMessages,
                tools,
                tool_choice: 'auto',
                stream: false, // non-streaming for tool loop; we stream the final chunk ourselves
                max_tokens: 2048,
                temperature: 0.3,
              }),
            }
          )

          if (!openaiRes.ok) {
            const errText = await openaiRes.text()
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: `OpenAI error: ${errText}` })}\n\n`
              )
            )
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            return
          }

          const completion = (await openaiRes.json()) as {
            choices: Array<{
              message: {
                role: string
                content: string | null
                tool_calls?: Array<{
                  id: string
                  type: string
                  function: { name: string; arguments: string }
                }>
              }
              finish_reason: string
            }>
          }

          const choice = completion.choices[0]
          const assistantMessage = choice.message

          // Add assistant's message to context
          chatMessages.push(assistantMessage as never)

          if (
            choice.finish_reason === 'tool_calls' &&
            assistantMessage.tool_calls?.length
          ) {
            // Signal tool calls to the client
            for (const toolCall of assistantMessage.tool_calls) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_call',
                    tool: toolCall.function.name,
                    call_id: toolCall.id,
                  })}\n\n`
                )
              )
            }

            // Execute all tool calls
            const toolResults = await Promise.all(
              assistantMessage.tool_calls.map(async (toolCall) => {
                let args: Record<string, string> = {}
                try {
                  args = JSON.parse(toolCall.function.arguments)
                } catch {
                  // ignore parse errors
                }

                let result: unknown
                try {
                  result = await executeTool(toolCall.function.name, args)
                } catch (err) {
                  result = {
                    error:
                      err instanceof Error ? err.message : 'Error desconocido',
                  }
                }

                return {
                  role: 'tool' as const,
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(result),
                }
              })
            )

            // Add tool results to context and signal client
            for (const toolResult of toolResults) {
              chatMessages.push(toolResult as never)
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_result',
                    call_id: toolResult.tool_call_id,
                  })}\n\n`
                )
              )
            }

            // Continue loop to get final response
          } else {
            // Final text response — stream it token by token (simulate streaming)
            const content = assistantMessage.content ?? ''

            // Stream in chunks to give the feel of streaming
            const chunkSize = 4
            for (let i = 0; i < content.length; i += chunkSize) {
              const chunk = content.slice(i, i + chunkSize)
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`
                )
              )
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            continueLoop = false
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: message })}\n\n`
          )
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
