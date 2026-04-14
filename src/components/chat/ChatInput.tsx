'use client'

import { useRef, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) {
        onSend()
      }
    }
  }

  const handleInput = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-gray-700 bg-gray-800 px-3 py-2 focus-within:border-blue-500/50 transition-colors">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          handleInput()
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Preguntá sobre candidatos, vacantes, estadísticas..."
        className="flex-1 resize-none bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none disabled:opacity-50"
        style={{ minHeight: '24px', maxHeight: '160px' }}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Enviar mensaje"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  )
}
