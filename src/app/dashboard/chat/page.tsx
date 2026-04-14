'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import ChatMessage, { type MessageRole } from '@/components/chat/ChatMessage'
import ChatInput from '@/components/chat/ChatInput'
import ToolCallIndicator from '@/components/chat/ToolCallIndicator'
import SuggestedQuestions from '@/components/chat/SuggestedQuestions'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: MessageRole
  content: string
}

interface ToolCallState {
  id: string
  tool: string
  done: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallState[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent, activeToolCalls])

  const clearConversation = () => {
    if (abortRef.current) abortRef.current.abort()
    setMessages([])
    setStreamingContent('')
    setActiveToolCalls([])
    setIsLoading(false)
    setInput('')
  }

  const sendMessage = useCallback(
    async (text?: string) => {
      const userText = (text ?? input).trim()
      if (!userText || isLoading) return

      setInput('')
      setStreamingContent('')
      setActiveToolCalls([])

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText,
      }

      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setIsLoading(true)

      // Build payload — only role + content for the API
      const payload = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.NEXT_PUBLIC_SYNC_API_KEY ?? '',
          },
          body: JSON.stringify({ messages: payload }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const raw = decoder.decode(value, { stream: true })
          const lines = raw.split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()

            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data) as {
                type?: string
                content?: string
                tool?: string
                call_id?: string
                error?: string
              }

              if (parsed.error) {
                accumulated = `Error: ${parsed.error}`
                setStreamingContent(accumulated)
                continue
              }

              if (parsed.type === 'tool_call' && parsed.tool && parsed.call_id) {
                setActiveToolCalls((prev) => [
                  ...prev,
                  { id: parsed.call_id!, tool: parsed.tool!, done: false },
                ])
              } else if (
                parsed.type === 'tool_result' &&
                parsed.call_id
              ) {
                setActiveToolCalls((prev) =>
                  prev.map((tc) =>
                    tc.id === parsed.call_id ? { ...tc, done: true } : tc
                  )
                )
              } else if (
                parsed.type === 'delta' &&
                parsed.content
              ) {
                accumulated += parsed.content
                setStreamingContent(accumulated)
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        // Finalise: add assistant message, clear streaming state
        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: accumulated,
            },
          ])
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content:
                'Hubo un error al procesar tu consulta. Por favor, intentá de nuevo.',
            },
          ])
        }
      } finally {
        setStreamingContent('')
        setActiveToolCalls([])
        setIsLoading(false)
        abortRef.current = null
      }
    },
    [input, messages, isLoading]
  )

  const isEmpty = messages.length === 0 && !isLoading

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col lg:h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Asistente IA</h1>
          <p className="mt-1 text-sm text-gray-400">
            Consultá datos de Zoho Recruit en lenguaje natural.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
          >
            <Trash2 className="h-4 w-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4"
      >
        {isEmpty ? (
          /* Welcome state */
          <div className="flex h-full flex-col items-center justify-center gap-8 px-4">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-8 w-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-200">
                ¿En qué puedo ayudarte?
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Tengo acceso en tiempo real a los datos de Zoho Recruit.
              </p>
            </div>
            <SuggestedQuestions onSelect={(q) => sendMessage(q)} />
          </div>
        ) : (
          /* Conversation */
          <div className="space-y-4 px-2">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
              />
            ))}

            {/* Tool call indicators */}
            {activeToolCalls.length > 0 && (
              <div className="flex flex-col gap-1.5 pl-11">
                {activeToolCalls.map((tc) => (
                  <ToolCallIndicator
                    key={tc.id}
                    toolName={tc.tool}
                    done={tc.done}
                  />
                ))}
              </div>
            )}

            {/* Streaming assistant message */}
            {streamingContent && (
              <ChatMessage
                role="assistant"
                content={streamingContent}
                isStreaming
              />
            )}

            {/* Loading with no content yet */}
            {isLoading && !streamingContent && activeToolCalls.length === 0 && (
              <div className="flex items-center gap-3 pl-11">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 pt-4">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => sendMessage()}
          disabled={isLoading}
        />
        <p className="mt-2 text-center text-xs text-gray-600">
          Los datos se consultan en tiempo real desde Zoho Recruit.
        </p>
      </div>
    </div>
  )
}
