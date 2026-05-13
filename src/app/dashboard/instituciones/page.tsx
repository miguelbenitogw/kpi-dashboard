'use client'

import { useState } from 'react'
import { RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import InstitutionesView from '@/components/atraccion/InstitutionesView'

function SyncInstitutionsButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [detail, setDetail] = useState<string | null>(null)
  const running = status === 'running'

  async function handleSync() {
    setStatus('running')
    setDetail(null)
    try {
      const res = await fetch('/api/admin/sync-institutions', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setStatus('error')
        setDetail(data.error ?? `HTTP ${res.status}`)
        return
      }
      const { inserted = 0, updated = 0, skipped = 0 } = data.total ?? {}
      setStatus('done')
      setDetail(`${inserted} nuevas · ${updated} actualizadas · ${skipped} sin cambios`)
    } catch (e) {
      setStatus('error')
      setDetail(String(e))
    }
  }

  const chip = status !== 'idle' ? (() => {
    const c = {
      running: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e4b9e' },
      done:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
      error:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
      idle:    { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8' },
    }[status]
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 6,
        border: `1px solid ${c.border}`, background: c.bg,
        fontSize: 11, fontWeight: 500, color: c.text,
      }}>
        {status === 'running' && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
        {status === 'done'    && <CheckCircle2 size={11} />}
        {status === 'error'   && <XCircle size={11} />}
        {detail ?? (status === 'running' ? 'Importando desde Google Sheets…' : '')}
      </span>
    )
  })() : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        onClick={handleSync}
        disabled={running}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 7, fontWeight: 600, fontSize: 12,
          border: `1px solid ${running ? '#cbd5e1' : '#c7d2fe'}`,
          background: running ? '#f8fafc' : '#eff6ff',
          color: running ? '#94a3b8' : '#1e4b9e',
          cursor: running ? 'not-allowed' : 'pointer',
        }}
      >
        {running
          ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          : <RefreshCw size={13} />}
        {running ? 'Sincronizando…' : 'Sincronizar instituciones'}
      </button>
      {chip}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function InstitucionesPage() {
  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.01em', margin: 0 }}>
            Instituciones
          </h1>
          <p style={{ fontSize: 13, color: '#78716c', marginTop: 4 }}>
            BBDD de universidades y centros por programa
          </p>
        </div>
        <SyncInstitutionsButton />
      </div>

      <InstitutionesView />
    </div>
  )
}
