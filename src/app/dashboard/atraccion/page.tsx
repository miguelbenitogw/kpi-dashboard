'use client'

import { useState, type CSSProperties } from 'react'
import { RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import VacancyRecruitmentTable from '@/components/atraccion/VacancyRecruitmentTable'
import VacancyStatusCharts from '@/components/atraccion/VacancyStatusCharts'
import ReceivedCvsByVacancyView from '@/components/atraccion/ReceivedCvsByVacancyView'
import ClosedVacancyCvsView from '@/components/atraccion/ClosedVacancyCvsView'
import AtraccionResumen from '@/components/atraccion/AtraccionResumen'
import { type TipoProfesional, PROFESION_LABELS } from '@/lib/utils/vacancy-profession'
import { type VacancyCountry } from '@/lib/utils/vacancy-country'

type Tab = 'resumen' | 'vacantes' | 'cvs' | 'cerradas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen',   label: 'Resumen' },
  { id: 'vacantes',  label: 'Vacantes activas' },
  { id: 'cvs',       label: 'CVs recibidos' },
  { id: 'cerradas',  label: 'Vacantes cerradas' },
]

const ALL_PROFESIONES = Object.keys(PROFESION_LABELS) as TipoProfesional[]

const ALL_COUNTRIES: VacancyCountry[] = [
  'Noruega', 'Alemania', 'Bélgica', 'Holanda', 'Francia', 'España', 'Suiza', 'Italia', 'Interno', 'Otros',
]

const SELECT_STYLE: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e7e2d8',
  borderRadius: 8,
  color: '#1c1917',
  fontSize: 12,
  padding: '6px 12px',
  cursor: 'pointer',
  appearance: 'auto',
}

// ─── Sync all active vacancies button (for Vacantes tab) ─────────────────────

function SyncAllActiveVacanciesButton() {
  const [phase1, setPhase1] = useState<'idle'|'running'|'done'|'error'>('idle')
  const [phase2, setPhase2] = useState<'idle'|'running'|'done'|'error'>('idle')
  const [detail1, setDetail1] = useState<string|null>(null)
  const [detail2, setDetail2] = useState<string|null>(null)
  const running = phase1 === 'running' || phase2 === 'running'

  async function handleSync() {
    setPhase1('running'); setPhase2('idle'); setDetail1(null); setDetail2(null)
    try {
      const r1 = await fetch('/api/admin/sync-zoho-vacancies', { method: 'POST' })
      const d1 = await r1.json()
      if (!r1.ok || d1.error) { setPhase1('error'); setDetail1(d1.error ?? `HTTP ${r1.status}`); return }
      setPhase1('done'); setDetail1(d1.synced != null ? `${d1.synced} vacantes` : null)
    } catch(e) { setPhase1('error'); setDetail1(String(e)); return }

    setPhase2('running')
    try {
      const r2 = await fetch('/api/admin/sync-vacancy-stats-session', { method: 'POST' })
      const d2 = await r2.json()
      if (!r2.ok || d2.error) { setPhase2('error'); setDetail2(d2.error ?? `HTTP ${r2.status}`); return }
      setPhase2('done'); setDetail2(d2.vacancies_processed != null ? `${d2.vacancies_processed} vacantes` : null)
    } catch(e) { setPhase2('error'); setDetail2(String(e)) }
  }

  const phases = [
    { key: 'p1', label: 'Metadatos', status: phase1, detail: detail1 },
    { key: 'p2', label: 'Estados (~1 min)', status: phase2, detail: detail2 },
  ] as const

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        onClick={handleSync} disabled={running}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 7, fontWeight: 600, fontSize: 12,
          border: `1px solid ${running ? '#cbd5e1' : '#c7d2fe'}`,
          background: running ? '#f8fafc' : '#eff6ff',
          color: running ? '#94a3b8' : '#1e4b9e',
          cursor: running ? 'not-allowed' : 'pointer',
        }}
      >
        {running ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
        {running ? 'Sincronizando…' : 'Sincronizar todas las vacantes activas'}
      </button>
      {phases.filter(p => p.status !== 'idle').map(p => {
        const c = { running: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e4b9e' }, done: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' }, error: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' }, idle: { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8' } }[p.status]
        return (
          <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: `1px solid ${c.border}`, background: c.bg, fontSize: 11, fontWeight: 500, color: c.text }}>
            {p.status === 'running' && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
            {p.status === 'done'    && <CheckCircle2 size={11} />}
            {p.status === 'error'   && <XCircle size={11} />}
            {p.label}{p.detail ? ` · ${p.detail}` : ''}
          </span>
        )
      })}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function AtraccionPage() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [profesionFilter, setProfesionFilter] = useState<TipoProfesional | 'todos'>('todos')
  const [countryFilter, setCountryFilter] = useState<VacancyCountry | 'todos'>('todos')

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

      {/* Filters bar — profesión pills + país select */}
      {tab !== 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Profesión pills */}
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

          {/* País select — shown in vacantes and cerradas tabs */}
          {(tab === 'vacantes' || tab === 'cerradas') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#a8a29e', fontWeight: 500 }}>País:</span>
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value as VacancyCountry | 'todos')}
                style={SELECT_STYLE}
              >
                <option value="todos">Todos los países</option>
                {ALL_COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ─── RESUMEN ─── */}
      {tab === 'resumen' && <AtraccionResumen />}

      {/* ─── VACANTES ─── */}
      {tab === 'vacantes' && (
        <div className="space-y-4">
          <SyncAllActiveVacanciesButton />
          <VacancyStatusCharts
            profesionFilter={profesionFilter}
            countryFilter={countryFilter}
          />
          <VacancyRecruitmentTable profesionFilter={profesionFilter} />
        </div>
      )}

      {/* ─── CVS RECIBIDOS ─── */}
      {tab === 'cvs' && (
        <ReceivedCvsByVacancyView profesionFilter={profesionFilter} />
      )}

      {/* ─── CVS CERRADAS ─── */}
      {tab === 'cerradas' && (
        <ClosedVacancyCvsView profesionFilter={profesionFilter} countryFilter={countryFilter} />
      )}
    </div>
  )
}
