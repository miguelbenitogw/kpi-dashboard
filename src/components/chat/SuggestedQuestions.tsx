'use client'

const QUESTIONS = [
  '¿Cuántos candidatos hay en cada promo?',
  '¿Cuántos candidatos están en estado Hired?',
  '¿Cuáles son las vacantes activas?',
  '¿Cuántos candidatos hay en In Training?',
  'Mostrame el pipeline completo de candidatos',
]

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void
}

export default function SuggestedQuestions({
  onSelect,
}: SuggestedQuestionsProps) {
  return (
    <div className="space-y-3">
      <p className="text-center text-xs text-gray-500 uppercase tracking-wide">
        Preguntas sugeridas
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="rounded-full border border-gray-700 bg-gray-800/60 px-4 py-1.5 text-sm text-gray-300 transition-colors hover:border-blue-500/50 hover:bg-gray-700 hover:text-white"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
