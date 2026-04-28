'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getConversionRates,
  type ConversionRates as ConversionRatesType,
} from '@/lib/queries/atraccion'
import { type TipoProfesional, PROFESION_LABELS } from '@/lib/utils/vacancy-profession'
import { type VacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'

// Countries shown in the filter (exclude Interno — excluded by default in query)
const FILTER_COUNTRIES: VacancyCountry[] = [
  'Noruega', 'Alemania', 'Bélgica', 'Holanda', 'Francia', 'España', 'Suiza', 'Italia', 'Interno', 'Otros',
]

const ALL_PROFESIONES = Object.keys(PROFESION_LABELS) as TipoProfesional[]

function rateStatus(rate: number): { color: string; label: string } {
  if (rate >= 15) return { color: '#16a34a', label: 'BIEN' }
  if (rate >= 8)  return { color: '#d97706', label: 'AVISO' }
  return { color: '#dc2626', label: 'RIESGO' }
}

function PillButton({
  active,
  onClick,
  children,
  bg,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  bg?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '2px 9px',
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        color: active ? '#ffffff' : '#78716c',
        background: active ? (bg ?? '#1e4b9e') : '#ffffff',
        border: `1px solid ${active ? (bg ?? '#1e4b9e') : '#e7e2d8'}`,
        borderRadius: 99,
        cursor: 'pointer',
        lineHeight: 1.6,
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  )
}

export default function ConversionRates() {
  const [rates, setRates] = useState<ConversionRatesType | null>(null)
  const [loading, setLoading] = useState(true)
  const [profesionFilter, setProfesionFilter] = useState<TipoProfesional | 'todos'>('todos')
  const [paisFilter, setPaisFilter] = useState<VacancyCountry | 'todos'>('todos')

  const load = useCallback(async (prof?: string, pais?: string) => {
    setLoading(true)
    const data = await getConversionRates(
      true,
      prof,
      pais,
    )
    setRates(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(
      profesionFilter === 'todos' ? undefined : profesionFilter,
      paisFilter === 'todos' ? undefined : paisFilter,
    )
  }, [load, profesionFilter, paisFilter])

  const hasActiveFilter = profesionFilter !== 'todos' || paisFilter !== 'todos'

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: 12,
        padding: '16px 20px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
          Tasas de Conversión
        </h2>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => { setProfesionFilter('todos'); setPaisFilter('todos') }}
            style={{
              fontSize: 11,
              color: '#1e4b9e',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontWeight: 500,
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Profession filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#a8a29e', fontWeight: 500, marginRight: 2, minWidth: 52 }}>Profesión:</span>
        <PillButton active={profesionFilter === 'todos'} onClick={() => setProfesionFilter('todos')}>
          Todos
        </PillButton>
        {ALL_PROFESIONES.map((prof) => (
          <PillButton
            key={prof}
            active={profesionFilter === prof}
            onClick={() => setProfesionFilter(profesionFilter === prof ? 'todos' : prof)}
          >
            {PROFESION_LABELS[prof]}
          </PillButton>
        ))}
      </div>

      {/* Country filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#a8a29e', fontWeight: 500, marginRight: 2, minWidth: 52 }}>País:</span>
        <PillButton active={paisFilter === 'todos'} onClick={() => setPaisFilter('todos')}>
          Todos
        </PillButton>
        {FILTER_COUNTRIES.map((country) => {
          const colors = COUNTRY_COLORS[country]
          const isActive = paisFilter === country
          return (
            <button
              key={country}
              type="button"
              onClick={() => setPaisFilter(isActive ? 'todos' : country)}
              style={{
                padding: '2px 9px',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? colors.text : '#78716c',
                background: isActive ? colors.bg : '#ffffff',
                border: `1px solid ${isActive ? colors.border : '#e7e2d8'}`,
                borderRadius: 99,
                cursor: 'pointer',
                lineHeight: 1.6,
                transition: 'all 0.1s',
              }}
            >
              {country}
            </button>
          )
        })}
      </div>

      {/* Metric cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                height: 88,
                borderRadius: 10,
                background: '#f5f1ea',
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
      ) : !rates ? (
        <p style={{ fontSize: 13, color: '#78716c', textAlign: 'center', padding: '16px 0' }}>
          Sin datos de conversión disponibles
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            {
              title: '% Conversión vs CVs',
              rate: rates.cvToApproved,
              detail: `${rates.approved.toLocaleString('es-AR')} aprobados de ${rates.totalCVs.toLocaleString('es-AR')} CVs`,
            },
            {
              title: '% Conversión vs Contactados',
              rate: rates.contactedToApproved,
              detail: `${rates.approved.toLocaleString('es-AR')} aprobados de ${rates.contacted.toLocaleString('es-AR')} contactados`,
            },
          ].map(({ title, rate, detail }) => {
            const { color, label } = rateStatus(rate)
            return (
              <div
                key={title}
                style={{
                  background: '#fafaf9',
                  border: '1px solid #e7e2d8',
                  borderRadius: 10,
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color,
                      background: `${color}18`,
                      border: `1px solid ${color}40`,
                      borderRadius: 99,
                      padding: '1px 7px',
                    }}
                  >
                    {label}
                  </span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1c1917', lineHeight: 1 }}>
                  {rate.toLocaleString('es-AR')}%
                </div>
                <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 4 }}>
                  {detail}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
