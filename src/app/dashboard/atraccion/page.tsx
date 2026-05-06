'use client'

import { useState } from 'react'
import VacancyRecruitmentTable from '@/components/atraccion/VacancyRecruitmentTable'
import VacancyStatusCharts from '@/components/atraccion/VacancyStatusCharts'
import ReceivedCvsByVacancyView from '@/components/atraccion/ReceivedCvsByVacancyView'
import ClosedVacancyCvsView from '@/components/atraccion/ClosedVacancyCvsView'
import AtraccionResumen from '@/components/atraccion/AtraccionResumen'
import { type TipoProfesional, PROFESION_LABELS } from '@/lib/utils/vacancy-profession'

type Tab = 'resumen' | 'vacantes' | 'cvs' | 'cerradas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen',   label: 'Resumen' },
  { id: 'vacantes',  label: 'Vacantes activas' },
  { id: 'cvs',       label: 'CVs recibidos' },
  { id: 'cerradas',  label: 'CVs cerradas' },
]

const ALL_PROFESIONES = Object.keys(PROFESION_LABELS) as TipoProfesional[]

export default function AtraccionPage() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [profesionFilter, setProfesionFilter] = useState<TipoProfesional | 'todos'>('todos')

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.01em', margin: 0 }}>
          Atracción
        </h1>
        <p style={{ fontSize: 13, color: '#78716c', marginTop: 4 }}>
          Vacantes activas, pipeline y conversión inicial
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e7e2d8' }}>
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? '#1e4b9e' : '#78716c',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? '#1e4b9e' : 'transparent'}`,
                cursor: 'pointer',
                marginBottom: -1,
                lineHeight: 1,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Profesion filter — shared across all tabs */}
      {tab !== 'resumen' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#a8a29e', fontWeight: 500, marginRight: 2 }}>Profesión:</span>
          <button
            type="button"
            onClick={() => setProfesionFilter('todos')}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: profesionFilter === 'todos' ? 600 : 400,
              color: profesionFilter === 'todos' ? '#ffffff' : '#78716c',
              background: profesionFilter === 'todos' ? '#1e4b9e' : '#ffffff',
              border: `1px solid ${profesionFilter === 'todos' ? '#1e4b9e' : '#e7e2d8'}`,
              borderRadius: 99,
              cursor: 'pointer',
              lineHeight: 1.5,
            }}
          >
            Todos
          </button>
          {ALL_PROFESIONES.map((prof) => {
            const active = profesionFilter === prof
            return (
              <button
                key={prof}
                type="button"
                onClick={() => setProfesionFilter(active ? 'todos' : prof)}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#ffffff' : '#78716c',
                  background: active ? '#1e4b9e' : '#ffffff',
                  border: `1px solid ${active ? '#1e4b9e' : '#e7e2d8'}`,
                  borderRadius: 99,
                  cursor: 'pointer',
                  lineHeight: 1.5,
                }}
              >
                {PROFESION_LABELS[prof]}
              </button>
            )
          })}
        </div>
      )}

      {/* ─── RESUMEN ─── */}
      {tab === 'resumen' && <AtraccionResumen />}

      {/* ─── VACANTES ─── */}
      {tab === 'vacantes' && (
        <div className="space-y-4">
          <VacancyStatusCharts />
          <VacancyRecruitmentTable profesionFilter={profesionFilter} />
        </div>
      )}

      {/* ─── CVS RECIBIDOS ─── */}
      {tab === 'cvs' && (
        <ReceivedCvsByVacancyView profesionFilter={profesionFilter} />
      )}

      {/* ─── CVS CERRADAS ─── */}
      {tab === 'cerradas' && (
        <ClosedVacancyCvsView profesionFilter={profesionFilter} />
      )}
    </div>
  )
}
