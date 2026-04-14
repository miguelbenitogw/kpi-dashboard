'use client'

import { Bot, User } from 'lucide-react'

export type MessageRole = 'user' | 'assistant'

export interface ChatMessageProps {
  role: MessageRole
  content: string
  isStreaming?: boolean
}

export default function ChatMessage({
  role,
  content,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-blue-400'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-blue-600 text-white'
            : 'rounded-tl-sm bg-gray-800 text-gray-100'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {content}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-blue-400" />
          )}
        </p>
      </div>
    </div>
  )
}
