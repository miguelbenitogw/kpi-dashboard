'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Loader2, CheckCircle2, XCircle, X } from 'lucide-react'
import InstitutionesView from '@/components/atraccion/InstitutionesView'

// Vercel maxDuration = 300s — abort 20s before to get a clean error instead of a hung promise
const FETCH_TIMEOUT_MS = 280_000

function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number>(0)
  useEffect(() => {
    if (running) {
      startRef.current = Date.now()
      setElapsed(0)
      const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
      return () => clearInterval(id)
    } else {
      setElapsed(0)
    }
  }, [running])
  return elapsed
}

function SyncInstitutionsButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [detail, setDetail] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const running = status === 'running'
  const elapsed = useElapsed(running)

  function handleCancel() {
    controllerRef.current?.abort()
    setStatus('error')
    setDetail('Cancelado por el usuario')
  }

  async function handleSync() {
    setStatus('running')
    setDetail(null)

    const controller = new AbortController()
    controllerRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const res = await fetch('/api/admin/sync-institutions', {
        method: 'POST',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        // Body was cut off or not JSON (e.g. Vercel 504 HTML)
        setStatus('error')
        setDetail(`HTTP ${res.status} — respuesta no válida del servidor`)
        return
      }

      if (!res.ok || data.error) {
        setStatus('error')
        setDetail((data.error as string) ?? `HTTP ${res.status}`)
        return
      }

      const total = (data.total ?? {}) as Record<string, number>
      const { inserted = 0, updated = 0, skipped = 0 } = total
      setStatus('done')
      setDetail(`${inserted} nuevas · ${updated} actualizadas · ${skipped} sin cambios`)
    } catch (e) {
      clearTimeout(timeoutId)
      if (e instanceof Error && e.name === 'AbortError') {
        // Only set error if user didn't manually cancel (cancel sets it directly)
        if (status !== 'error') {
          setStatus('error')
          setDetail('Tiempo de espera agotado (>4min) — la sincronización puede haberse completado en el servidor')
        }
      } else {
        setStatus('error')
        setDetail(String(e))
      }
    } finally {
      controllerRef.current = null
    }
  }

  const c = {
    running: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e4b9e' },
    done:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
    error:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    idle:    { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8' },
  }[status]

  const chipText = detail
    ?? (running ? `Importando desde Google Sheets… (${elapsed}s)` : '')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={running ? undefined : handleSync}
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

      {status !== 'idle' && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 6,
          border: `1px solid ${c.border}`, background: c.bg,
          fontSize: 11, fontWeight: 500, color: c.text,
          maxWidth: 420,
        }}>
          {running    && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
          {status === 'done'  && <CheckCircle2 size={11} style={{ flexShrink: 0 }} />}
          {status === 'error' && <XCircle size={11} style={{ flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {chipText}
          </span>
          {/* Cancel button when running */}
          {running && (
            <button
              onClick={handleCancel}
              title="Cancelar"
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                padding: '0 2px', color: '#94a3b8', display: 'flex', alignItems: 'center',
                flexShrink: 0, marginLeft: 2,
              }}
            >
              <X size={11} />
            </button>
          )}
          {/* Dismiss button when done or error */}
          {!running && (
            <button
              onClick={() => { setStatus('idle'); setDetail(null) }}
              title="Cerrar"
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                padding: '0 2px', color: '#94a3b8', display: 'flex', alignItems: 'center',
                flexShrink: 0, marginLeft: 2,
              }}
            >
              <X size={11} />
            </button>
          )}
        </span>
      )}

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
