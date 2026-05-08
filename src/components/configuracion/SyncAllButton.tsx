'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'

interface PhaseSummary {
  phase: string
  duration_ms: number
  updated: number
  inserted: number
  errors: number
  skipped: number
  all_errors: string[]
}

type PhaseState = 'pending' | 'running' | 'done' | 'error'

interface PhaseStatus {
  key: 'excel-madre' | 'promo-sheets' | 'placement'
  label: string
  state: PhaseState
  result: PhaseSummary | null
  error: string | null
}

const PHASES: PhaseStatus[] = [
  { key: 'excel-madre',   label: 'Excel Madre',    state: 'pending', result: null, error: null },
  { key: 'promo-sheets',  label: 'Promo Sheets',   state: 'pending', result: null, error: null },
  { key: 'placement',     label: 'GP Placement',   state: 'pending', result: null, error: null },
]

export default function SyncAllButton() {
  const [running, setRunning] = useState(false)
  const [phases, setPhases] = useState<PhaseStatus[]>(PHASES.map(p => ({ ...p })))
  const [done, setDone] = useState(false)

  function updatePhase(key: string, patch: Partial<PhaseStatus>) {
    setPhases(prev => prev.map(p => p.key === key ? { ...p, ...patch } : p))
  }

  async function callPhase(key: string): Promise<PhaseSummary | null> {
    updatePhase(key, { state: 'running', error: null, result: null })
    try {
      const res = await fetch(`/api/admin/sync-all?phase=${key}`, { method: 'POST' })
      const text = await res.text()
      let data: PhaseSummary
      try {
        data = JSON.parse(text)
      } catch {
        updatePhase(key, { state: 'error', error: `HTTP ${res.status}: ${text.slice(0, 200)}` })
        return null
      }
      if (!res.ok && !('phase' in data)) {
        updatePhase(key, { state: 'error', error: (data as any).error ?? `HTTP ${res.status}` })
        return null
      }
      updatePhase(key, { state: data.errors > 0 ? 'error' : 'done', result: data })
      return data
    } catch (e) {
      updatePhase(key, { state: 'error', error: String(e) })
      return null
    }
  }

  async function handleSync() {
    setRunning(true)
    setDone(false)
    setPhases(PHASES.map(p => ({ ...p })))

    await callPhase('excel-madre')
    await callPhase('promo-sheets')
    await callPhase('placement')

    setRunning(false)
    setDone(true)
  }

  const hasAnyError = phases.some(p => p.state === 'error')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Button row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSync}
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

        {done && !running && (
          hasAnyError
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#dc2626', fontWeight: 500 }}><XCircle size={15} />Completado con errores</span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#16a34a', fontWeight: 500 }}><CheckCircle2 size={15} />Todo sincronizado</span>
        )}
      </div>

      {/* Phase cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {phases.map(p => <PhaseCard key={p.key} phase={p} />)}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function PhaseCard({ phase }: { phase: PhaseStatus }) {
  const { state, label, result, error } = phase
  const r = result

  const colors = {
    pending: { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' },
    running: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e4b9e' },
    done:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
    error:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  }[state]

  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 14px', minWidth: 170 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {state === 'pending' && <Clock size={13} color={colors.text} />}
        {state === 'running' && <Loader2 size={13} color={colors.text} style={{ animation: 'spin 1s linear infinite' }} />}
        {state === 'done'    && <CheckCircle2 size={13} color={colors.text} />}
        {state === 'error'   && <XCircle size={13} color={colors.text} />}
        <span style={{ fontSize: 11, fontWeight: 700, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>

      {state === 'pending' && <div style={{ fontSize: 11, color: '#94a3b8' }}>En espera…</div>}
      {state === 'running' && <div style={{ fontSize: 11, color: colors.text }}>Procesando…</div>}

      {r && (
        <div style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {r.updated  > 0 && <span>{r.updated} actualizados</span>}
          {r.inserted > 0 && <span>{r.inserted} insertados</span>}
          {r.skipped  > 0 && <span style={{ color: '#94a3b8' }}>{r.skipped} omitidos</span>}
          {r.errors   > 0 && <span style={{ color: '#dc2626' }}>{r.errors} errores</span>}
          <span style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>{(r.duration_ms / 1000).toFixed(1)}s</span>
        </div>
      )}

      {error && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>Ver error</summary>
          <div style={{ fontSize: 10, color: '#7f1d1d', fontFamily: 'monospace', marginTop: 3, wordBreak: 'break-all' }}>{error}</div>
        </details>
      )}

      {r && r.all_errors.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>{r.all_errors.length} error{r.all_errors.length !== 1 ? 'es' : ''}</summary>
          <ul style={{ margin: '4px 0 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {r.all_errors.map((e, i) => (
              <li key={i} style={{ fontSize: 10, color: '#7f1d1d', fontFamily: 'monospace' }}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
