'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type SyncState = 'idle' | 'running' | 'done' | 'error'

interface SyncSummary {
  duration_ms: number
  excel_madre:  { updated: number; inserted: number; errors: number }
  promo_sheets: { success: number; error: number; skipped: number }
  placement:    { updated: number; inserted: number; errors: number }
  all_errors:   string[]
}

export default function SyncAllButton() {
  const [state, setState] = useState<SyncState>('idle')
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  async function handleSync() {
    setState('running')
    setSummary(null)
    setErrors([])
    try {
      const res = await fetch('/api/admin/sync-all', { method: 'POST' })
      const data = await res.json()
      setSummary(data.summary ?? null)
      setErrors(data.errors ?? [])
      setState(data.summary?.all_errors?.length > 0 ? 'error' : 'done')
    } catch (e) {
      console.error('sync-all error:', e)
      setState('error')
      setErrors([String(e)])
    }
  }

  const isRunning = state === 'running'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSync}
          disabled={isRunning}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 20px',
            borderRadius: 8,
            border: 'none',
            background: isRunning ? '#94a3b8' : '#1e4b9e',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {isRunning
            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            : <RefreshCw size={15} />}
          {isRunning ? 'Sincronizando…' : 'Sincronizar todo'}
        </button>

        {state === 'done' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
            <CheckCircle2 size={15} />
            {summary ? `Listo en ${(summary.duration_ms / 1000).toFixed(1)}s` : 'Listo'}
          </span>
        )}
        {state === 'error' && !isRunning && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
            <XCircle size={15} />
            Completado con errores
          </span>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SummaryCard
            label="Excel Madre"
            lines={[
              `${summary.excel_madre.updated} actualizados`,
              `${summary.excel_madre.inserted} insertados`,
              summary.excel_madre.errors > 0 ? `${summary.excel_madre.errors} errores` : null,
            ]}
            hasError={summary.excel_madre.errors > 0}
          />
          <SummaryCard
            label="Promo Sheets"
            lines={[
              `${summary.promo_sheets.success} exitosos`,
              summary.promo_sheets.skipped > 0 ? `${summary.promo_sheets.skipped} omitidos` : null,
              summary.promo_sheets.error > 0 ? `${summary.promo_sheets.error} errores` : null,
            ]}
            hasError={summary.promo_sheets.error > 0}
          />
          <SummaryCard
            label="Placement"
            lines={[
              `${summary.placement.updated} candidatos actualizados`,
              `${summary.placement.inserted} aplicaciones`,
              summary.placement.errors > 0 ? `${summary.placement.errors} errores` : null,
            ]}
            hasError={summary.placement.errors > 0}
          />
        </div>
      )}

      {/* Error list */}
      {errors.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}>
            {errors.length} error{errors.length !== 1 ? 'es' : ''} — ver detalles
          </summary>
          <ul style={{ marginTop: 6, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {errors.map((e, i) => (
              <li key={i} style={{ fontSize: 11, color: '#7f1d1d', fontFamily: 'monospace' }}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function SummaryCard({ label, lines, hasError }: { label: string; lines: (string | null)[]; hasError: boolean }) {
  const visibleLines = lines.filter(Boolean) as string[]
  return (
    <div style={{
      background: hasError ? '#fef2f2' : '#f0fdf4',
      border: `1px solid ${hasError ? '#fecaca' : '#bbf7d0'}`,
      borderRadius: 8,
      padding: '8px 14px',
      minWidth: 160,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: hasError ? '#dc2626' : '#16a34a', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      {visibleLines.map((line, i) => (
        <div key={i} style={{ fontSize: 12, color: hasError && line.includes('error') ? '#dc2626' : '#374151' }}>{line}</div>
      ))}
    </div>
  )
}
