'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Loader2, Clock, Play } from 'lucide-react'
import { getMadreSheetsAction } from '@/app/dashboard/configuracion/actions'

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

interface JobDef {
  key: string
  label: string
  apiPhase: string
  sheetId?: string   // set for excel-madre per-sheet jobs
}

interface JobStatus extends JobDef {
  state: JobState
  result: PhaseSummary | null
  error: string | null
}

// Static jobs (non-madre)
const STATIC_JOBS: JobDef[] = [
  { key: 'promo-sheets',       label: 'Promo Sheets',        apiPhase: 'promo-sheets' },
  { key: 'placement',          label: 'Global Placement',    apiPhase: 'placement' },
  { key: 'zoho-vacancies',     label: 'Vacantes Zoho',       apiPhase: 'zoho-vacancies' },
  { key: 'vacancy-cvs',        label: 'CVs recibidos',       apiPhase: 'vacancy-cvs' },
  { key: 'vacancy-stats',      label: 'Stats por vacante',   apiPhase: 'vacancy-stats' },
  { key: 'germany',            label: 'Datos Alemania',      apiPhase: 'germany' },
  { key: 'germany-candidates', label: 'Candidatos Alemania', apiPhase: 'germany-candidates' },
  { key: 'social',             label: 'Redes Sociales',      apiPhase: 'social' },
  { key: 'atraccion-history',  label: 'Historial Atracción', apiPhase: 'atraccion-history' },
]

function makeStatus(def: JobDef): JobStatus {
  return { ...def, state: 'idle', result: null, error: null }
}

function buildApiUrl(job: JobDef): string {
  const url = `/api/admin/sync-all?phase=${job.apiPhase}`
  return job.sheetId ? `${url}&sheetId=${encodeURIComponent(job.sheetId)}` : url
}

export default function SyncAllButton() {
  const [madreJobs, setMadreJobs]   = useState<JobStatus[]>([])
  const [staticJobs, setStaticJobs] = useState<JobStatus[]>(STATIC_JOBS.map(makeStatus))
  const [running, setRunning]       = useState(false)
  const [globalDone, setGlobalDone] = useState(false)
  const [loadingSheets, setLoadingSheets] = useState(true)

  // Load madre sheets once on mount
  useEffect(() => {
    getMadreSheetsAction().then((sheets) => {
      const active = sheets.filter((s: any) => s.is_active)
      const defs: JobDef[] = active.map((s: any) => ({
        key: `excel-madre:${s.sheet_id}`,
        label: s.label ?? `Madre ${s.year ?? ''}`,
        apiPhase: 'excel-madre',
        sheetId: s.sheet_id,
      }))
      setMadreJobs(defs.map(makeStatus))
      setLoadingSheets(false)
    }).catch(() => setLoadingSheets(false))
  }, [])

  const allJobs = [...madreJobs, ...staticJobs]

  function patchJob(key: string, patch: Partial<JobStatus>, isMadre: boolean) {
    if (isMadre) {
      setMadreJobs(prev => prev.map(j => j.key === key ? { ...j, ...patch } : j))
    } else {
      setStaticJobs(prev => prev.map(j => j.key === key ? { ...j, ...patch } : j))
    }
  }

  async function callJob(job: JobDef): Promise<PhaseSummary | null> {
    const isMadre = job.apiPhase === 'excel-madre'
    patchJob(job.key, { state: 'running', error: null, result: null }, isMadre)
    try {
      const res  = await fetch(buildApiUrl(job), { method: 'POST' })
      const text = await res.text()
      let data: PhaseSummary
      try {
        data = JSON.parse(text)
      } catch {
        patchJob(job.key, { state: 'error', error: `HTTP ${res.status}: ${text.slice(0, 200)}` }, isMadre)
        return null
      }
      if (!res.ok && !('phase' in data)) {
        patchJob(job.key, { state: 'error', error: (data as any).error ?? `HTTP ${res.status}` }, isMadre)
        return null
      }
      patchJob(job.key, { state: data.errors > 0 ? 'error' : 'done', result: data }, isMadre)
      return data
    } catch (e) {
      patchJob(job.key, { state: 'error', error: String(e) }, isMadre)
      return null
    }
  }

  async function handleSyncAll() {
    setRunning(true)
    setGlobalDone(false)
    setMadreJobs(prev => prev.map(j => ({ ...j, state: 'idle', result: null, error: null })))
    setStaticJobs(STATIC_JOBS.map(makeStatus))

    for (const job of allJobs) {
      await callJob(job)
    }

    setRunning(false)
    setGlobalDone(true)
  }

  async function handleSyncOne(job: JobDef) {
    if (running) return
    setGlobalDone(false)
    await callJob(job)
  }

  const hasAnyError = allJobs.some(j => j.state === 'error')

  const groups: { label: string; jobs: JobStatus[] }[] = [
    { label: 'Excel Madre',     jobs: madreJobs },
    { label: 'Noruega',         jobs: staticJobs.filter(j => ['promo-sheets', 'placement'].includes(j.key)) },
    { label: 'Zoho & Vacantes', jobs: staticJobs.filter(j => ['zoho-vacancies', 'vacancy-cvs', 'vacancy-stats'].includes(j.key)) },
    { label: 'Alemania',        jobs: staticJobs.filter(j => ['germany', 'germany-candidates'].includes(j.key)) },
    { label: 'Otros',           jobs: staticJobs.filter(j => ['social', 'atraccion-history'].includes(j.key)) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSyncAll}
          disabled={running || loadingSheets}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: (running || loadingSheets) ? '#94a3b8' : '#1e4b9e',
            color: '#fff', fontWeight: 600, fontSize: 14,
            cursor: (running || loadingSheets) ? 'not-allowed' : 'pointer',
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
      {groups.map(group => (
        <div key={group.label}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: '#64748b',
            marginBottom: 8, paddingBottom: 4,
            borderBottom: '1px solid #e7e2d8',
          }}>
            {group.label}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {group.label === 'Excel Madre' && loadingSheets ? (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Cargando sheets…</span>
            ) : group.jobs.map(job => (
              <JobCard
                key={job.key}
                job={job}
                disabled={running}
                onTrigger={() => handleSyncOne(job)}
              />
            ))}
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
      minWidth: 180, maxWidth: 240,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flexShrink: 0 }}>
          {state === 'idle'    && <Clock        size={13} color={c.text} />}
          {state === 'running' && <Loader2      size={13} color={c.text} style={{ animation: 'spin 1s linear infinite' }} />}
          {state === 'done'    && <CheckCircle2 size={13} color={c.text} />}
          {state === 'error'   && <XCircle      size={13} color={c.text} />}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: c.text,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          flex: 1, lineHeight: 1.3,
        }}>
          {label}
        </span>

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

      {state === 'idle'    && <div style={{ fontSize: 11, color: '#94a3b8' }}>En espera</div>}
      {state === 'running' && <div style={{ fontSize: 11, color: c.text }}>Procesando…</div>}

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

      {error && (
        <details style={{ marginTop: 2 }}>
          <summary style={{ fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>Ver error</summary>
          <div style={{ fontSize: 10, color: '#7f1d1d', fontFamily: 'monospace', marginTop: 3, wordBreak: 'break-all' }}>
            {error}
          </div>
        </details>
      )}

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
