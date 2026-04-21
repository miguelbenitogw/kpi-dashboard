'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ConversionRates from '@/components/atraccion/ConversionRates'
import WeeklyCVChart from '@/components/atraccion/WeeklyCVChart'
import AttractionTrafficLights from '@/components/atraccion/AttractionTrafficLights'
import CharlasSummary from '@/components/atraccion/CharlasSummary'
import VacancyRecruitmentTable from '@/components/atraccion/VacancyRecruitmentTable'

const SLIDES = [
  {
    id: 'graficos',
    label: 'Gráficos',
    subtitle: 'Tasas de conversión, CVs semanales y semáforos',
    dot: 'bg-blue-400',
  },
  {
    id: 'tabla',
    label: 'Tabla',
    subtitle: 'Candidatos por vacante y estado de reclutamiento',
    dot: 'bg-emerald-400',
  },
] as const

export default function AtraccionCarousel() {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)

  function goTo(idx: number) {
    if (idx === current) return
    setVisible(false)
    setTimeout(() => {
      setCurrent(idx)
      setVisible(true)
    }, 150)
  }

  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length)
  const next = () => goTo((current + 1) % SLIDES.length)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
      {/* Header con flechas + dots */}
      <div className="flex items-center gap-3 border-b border-gray-700/50 px-5 py-4">
        <button
          onClick={prev}
          aria-label="Anterior"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-600/50 bg-gray-700/40 text-gray-400 transition-all hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 active:scale-90"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-1 flex-col items-center gap-1">
          <h3 className="text-sm font-semibold text-gray-200">
            {SLIDES[current].label}
          </h3>
          <p className="text-center text-xs text-gray-500">
            {SLIDES[current].subtitle}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => goTo(i)}
                aria-label={`Ver ${slide.label}`}
                className={[
                  'rounded-full transition-all duration-300',
                  i === current
                    ? `h-1.5 w-5 ${slide.dot}`
                    : 'h-1.5 w-1.5 bg-gray-600 hover:bg-gray-400',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        <button
          onClick={next}
          aria-label="Siguiente"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-600/50 bg-gray-700/40 text-gray-400 transition-all hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 active:scale-90"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Contenido con transición de opacidad */}
      <div
        className="transition-opacity duration-150"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {current === 0 && (
          <div className="space-y-6 p-6">
            <ConversionRates />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <WeeklyCVChart />
              </div>
              <div>
                <AttractionTrafficLights />
              </div>
            </div>
            <CharlasSummary />
          </div>
        )}
        {current === 1 && (
          <div className="p-0">
            <VacancyRecruitmentTable />
          </div>
        )}
      </div>
    </div>
  )
}
