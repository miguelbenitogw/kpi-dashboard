'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Loader2, Clock, Play } from 'lucide-react'

interface PhaseSummary {
  phase: string
  duration_ms: number
  updated: number
  inserted: number
  errors: number
  skipped: number
  all_errors: string[]
}

type JobState = 'idle' | 'running' | 'done' | 'error'

type PhaseKey =
  | 'excel-madre'
  | 'promo-sheets'
  | 'placement'
  | 'zoho-vacancies'
  | 'vacancy-cvs'
  | 'vacancy-stats'
  | 'social'
  | 'germany'
  | 'germany-candidates'
  | 'atraccion-history'

interface JobStatus {
  key: PhaseKey
  label: string
  state: JobState
  result: PhaseSummary | null
  error: string | null
}

interface JobGroup {
  label: string
  jobs: PhaseKey[]
}

const JOB_DEFINITIONS: Record<PhaseKey, string> = {
  'excel-madre':        'Excel Madre (Base Datos + Resumen)',
  'promo-sheets':       'Promo Sheets',
  'placement':          'Global Placement',
  'zoho-vacancies':     'Vacantes Zoho',
  'vacancy-cvs':        'CVs recibidos',
  'vacancy-stats':      'Stats por vacante',
  'germany':            'Datos Alemania',
  'germany-candidates': 'Candidatos Alemania',
  'social':             'Redes Sociales',
  'atraccion-history':  'Historial Atracción',
}

const GROUPS: JobGroup[] = [
  { label: 'Excel Madre',     jobs: ['excel-madre', 'promo-sheets', 'placement'] },
  { label: 'Zoho & Vacantes', jobs: ['zoho-vacancies', 'vacancy-cvs', 'vacancy-stats'] },
  { label: 'Alemania',        jobs: ['germany', 'germany-candidates'] },
  { label: 'Otros',           jobs: ['social', 'atraccion-history'] },
]

const ALL_PHASES: PhaseKey[] = GROUPS.flatMap(g => g.jobs)

function makeInitialJobs(): JobStatus[] {
  return ALL_PHASES.map(key => ({
    key,
    label: JOB_DEFINITIONS[key],
    state: 'idle',
    result: null,
    error: null,
  }))
}

export default function SyncAllButton() {
  const [running, setRunning]       = useState(false)
  const [jobs, setJobs]             = useState<JobStatus[]>(makeInitialJobs())
  const [globalDone, setGlobalDone] = useState(false)

  function updateJob(key: PhaseKey, patch: Partial<JobStatus>) {
    setJobs(prev => prev.map(j => j.key === key ? { ...j, ...patch } : j))
  }

  async function callPhase(key: PhaseKey): Promise<PhaseSummary | null> {
    updateJob(key, { state: 'running', error: null, result: null })
    try {
      const res  = await fetch(`/api/admin/sync-all?phase=${key}`, { method: 'POST' })
      const text = await res.text()
      let data: PhaseSummary
      try {
        data = JSON.parse(text)
      } catch {
        updateJob(key, { state: 'error', error: `HTTP ${res.status}: ${text.slice(0, 200)}` })
        return null
      }
      if (!res.ok && !('phase' in data)) {
        updateJob(key, { state: 'error', error: (data as any).error ?? `HTTP ${res.status}` })
        return null
      }
      updateJob(key, { state: data.errors > 0 ? 'error' : 'done', result: data })
      return data
    } catch (e) {
      updateJob(key, { state: 'error', error: String(e) })
      return null
    }
  }

  async function handleSyncAll() {
    setRunning(true)
    setGlobalDone(false)
    setJobs(makeInitialJobs())

    for (const key of ALL_PHASES) {
      await callPhase(key)
    }

    setRunning(false)
    setGlobalDone(true)
  }

  async function handleSyncOne(key: PhaseKey) {
    if (running) return
    setGlobalDone(false)
    await callPhase(key)
  }

  const hasAnyError = jobs.some(j => j.state === 'error')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Top bar — Sincronizar todo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSyncAll}
          disabled={running}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: running ? '#94a3b8' : '#1e4b9e',
            color: '#fff', fontWeight: 600, fontSize: 14,
            cursor: running ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {running
            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            : <RefreshCw size={15} />}
          {running ? 'Sincronizando…' : 'Sincronizar todo'}
        </button>

        {globalDone && !running && (
          hasAnyError
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
                <XCircle size={15} />Completado con errores
              </span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
                <CheckCircle2 size={15} />Todo sincronizado
              </span>
        )}
      </div>

      {/* Groups */}
      {GROUPS.map(group => (
        <div key={group.label}>
          {/* Group header */}
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: '#64748b',
            marginBottom: 8, paddingBottom: 4,
            borderBottom: '1px solid #e7e2d8',
          }}>
            {group.label}
          </div>

          {/* Job cards */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {group.jobs.map(key => {
              const job = jobs.find(j => j.key === key)!
              return (
                <JobCard
                  key={key}
                  job={job}
                  disabled={running}
                  onTrigger={() => handleSyncOne(key)}
                />
              )
            })}
          </div>
        </div>
      ))}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JobCard
// ---------------------------------------------------------------------------
interface JobCardProps {
  job: JobStatus
  disabled: boolean
  onTrigger: () => void
}

function JobCard({ job, disabled, onTrigger }: JobCardProps) {
  const { state, label, result, error } = job

  const colors: Record<JobState, { bg: string; border: string; text: string }> = {
    idle:    { bg: '#f8fafc', border: '#e7e2d8', text: '#64748b' },
    running: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e4b9e' },
    done:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
    error:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  }

  const c = colors[state]

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: '10px 12px',
      minWidth: 180, maxWidth: 220,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* Header row: icon + label + trigger button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flexShrink: 0 }}>
          {state === 'idle'    && <Clock       size={13} color={c.text} />}
          {state === 'running' && <Loader2     size={13} color={c.text} style={{ animation: 'spin 1s linear infinite' }} />}
          {state === 'done'    && <CheckCircle2 size={13} color={c.text} />}
          {state === 'error'   && <XCircle     size={13} color={c.text} />}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: c.text,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          flex: 1, lineHeight: 1.3,
        }}>
          {label}
        </span>

        {/* Individual trigger button */}
        <button
          onClick={onTrigger}
          disabled={disabled || state === 'running'}
          title={`Sync ${label}`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 6, border: 'none', flexShrink: 0,
            background: (disabled || state === 'running') ? '#e2e8f0' : '#1e4b9e',
            color: (disabled || state === 'running') ? '#94a3b8' : '#fff',
            cursor: (disabled || state === 'running') ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {state === 'running'
            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : <Play size={10} />}
        </button>
      </div>

      {/* State message */}
      {state === 'idle'    && <div style={{ fontSize: 11, color: '#94a3b8' }}>En espera</div>}
      {state === 'running' && <div style={{ fontSize: 11, color: c.text }}>Procesando…</div>}

      {/* Result stats */}
      {result && (
        <div style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {result.updated  > 0 && <span>{result.updated} actualizados</span>}
          {result.inserted > 0 && <span>{result.inserted} insertados</span>}
          {result.skipped  > 0 && <span style={{ color: '#94a3b8' }}>{result.skipped} omitidos</span>}
          {result.errors   > 0 && <span style={{ color: '#dc2626' }}>{result.errors} errores</span>}
          <span style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>
            {(result.duration_ms / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {/* HTTP/network error */}
      {error && (
        <details style={{ marginTop: 2 }}>
          <summary style={{ fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>Ver error</summary>
          <div style={{ fontSize: 10, color: '#7f1d1d', fontFamily: 'monospace', marginTop: 3, wordBreak: 'break-all' }}>
            {error}
          </div>
        </details>
      )}

      {/* Business errors from result */}
      {result && result.all_errors.length > 0 && (
        <details style={{ marginTop: 2 }}>
          <summary style={{ fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>
            {result.all_errors.length} error{result.all_errors.length !== 1 ? 'es' : ''}
          </summary>
          <ul style={{ margin: '4px 0 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {result.all_errors.map((e, i) => (
              <li key={i} style={{ fontSize: 10, color: '#7f1d1d', fontFamily: 'monospace' }}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
