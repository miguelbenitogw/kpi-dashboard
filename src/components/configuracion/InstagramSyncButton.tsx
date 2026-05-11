'use client'

import { useState } from 'react'
import { Camera, Loader2, CheckCircle2, XCircle } from 'lucide-react'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface SyncResult {
  phase: string
  duration_ms: number
  inserted: number
  skipped: number
  errors: number
  all_errors: string[]
}

export default function InstagramSyncButton() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<SyncResult | null>(null)

  async function handleSync() {
    setPhase('running')
    setResult(null)

    try {
      const res = await fetch('/api/admin/sync-all?phase=social', { method: 'POST' })
      const data: SyncResult = await res.json()

      if (!res.ok && !data.phase) {
        setPhase('error')
        setResult({ phase: 'social', duration_ms: 0, inserted: 0, skipped: 0, errors: 1, all_errors: [(data as any).error ?? `HTTP ${res.status}`] })
        return
      }

      setPhase(data.errors > 0 ? 'error' : 'done')
      setResult(data)
    } catch (e) {
      setPhase('error')
      setResult({ phase: 'social', duration_ms: 0, inserted: 0, skipped: 0, errors: 1, all_errors: [String(e)] })
    }
  }

  const running = phase === 'running'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleSync}
          disabled={running}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: `1px solid ${running ? '#e2e8f0' : '#fbcfe8'}`,
            background: running ? '#f8fafc' : '#fdf2f8',
            color: running ? '#94a3b8' : '#be185d',
            cursor: running ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {running
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Camera size={14} />}
          {running ? 'Sincronizando Instagram…' : 'Sincronizar Instagram ahora'}
        </button>

        {/* Status badge */}
        {phase === 'done' && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid #bbf7d0', background: '#f0fdf4',
            fontSize: 12, fontWeight: 500, color: '#16a34a',
          }}>
            <CheckCircle2 size={12} />
            {result?.inserted ?? 0} cuentas sincronizadas
            {result?.duration_ms ? ` · ${(result.duration_ms / 1000).toFixed(1)}s` : ''}
          </span>
        )}

        {phase === 'error' && result?.errors === 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid #bbf7d0', background: '#f0fdf4',
            fontSize: 12, fontWeight: 500, color: '#16a34a',
          }}>
            <CheckCircle2 size={12} />
            OK con avisos
          </span>
        )}
      </div>

      {/* Error detail */}
      {phase === 'error' && result && result.all_errors.length > 0 && (
        <div style={{
          borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2',
          padding: '10px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <XCircle size={13} color="#dc2626" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
              Errores del sync
            </span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {result.all_errors.map((err, i) => (
              <li key={i} style={{ fontSize: 11, color: '#7f1d1d', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success detail */}
      {phase === 'done' && result && result.inserted > 0 && (
        <div style={{
          borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4',
          padding: '10px 14px', fontSize: 12, color: '#166534',
        }}>
          <strong>✓</strong> Se insertaron <strong>{result.inserted}</strong> snapshots en la DB.
          Recargá la vista de Analytics para ver los datos de Instagram actualizados.
        </div>
      )}

      {phase === 'done' && result && result.inserted === 0 && result.errors === 0 && (
        <div style={{
          borderRadius: 8, border: '1px solid #fde68a', background: '#fffbeb',
          padding: '10px 14px', fontSize: 12, color: '#92400e',
        }}>
          <strong>⚠</strong> Sync corrió pero no se insertó ningún snapshot.
          Verificá que el <code style={{ fontFamily: 'monospace' }}>META_ACCESS_TOKEN</code> en Vercel sea válido y tenga permisos de Instagram Business.
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
