'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PlusCircle,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Clock,
  XCircle,
} from 'lucide-react'
import {
  getRegisteredSheets,
  registerSheet,
  unregisterSheet,
  triggerSheetSync,
  getActivePromoOptions,
  type RegisteredSheet,
  type PromoOption,
} from '@/lib/queries/sheets'

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const C = {
  border:    '#e7e2d8',
  bg:        '#f8f7f4',
  white:     '#ffffff',
  text:      '#1c1917',
  muted:     '#78716c',
  faint:     '#a8a29e',
  blue:      '#1e4b9e',
  blueLight: '#eff6ff',
  blueBdr:   '#bfdbfe',
  green:     '#16a34a',
  greenBg:   '#f0fdf4',
  greenBdr:  '#bbf7d0',
  red:       '#dc2626',
  redBg:     '#fef2f2',
  redBdr:    '#fecaca',
  amber:     '#b45309',
  amberBg:   '#fffbeb',
  amberBdr:  '#fde68a',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  background: C.white,
  color: C.text,
  outline: 'none',
}

const EMPTY_FORM = { sheetUrl: '', promocionNombre: '', sheetName: '', groupFilter: '' }

// ---------------------------------------------------------------------------
// SheetStatusBadge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string | null }) {
  if (status === 'done') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, fontSize:11, fontWeight:500, background:C.greenBg, color:C.green, border:`1px solid ${C.greenBdr}` }}>
      <CheckCircle2 size={10} />done
    </span>
  )
  if (status === 'error') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, fontSize:11, fontWeight:500, background:C.redBg, color:C.red, border:`1px solid ${C.redBdr}` }}>
      <XCircle size={10} />error
    </span>
  )
  if (status === 'pending') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, fontSize:11, fontWeight:500, background:C.amberBg, color:C.amber, border:`1px solid ${C.amberBdr}` }}>
      <Clock size={10} />pending
    </span>
  )
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, fontSize:11, fontWeight:500, background:C.bg, color:C.faint, border:`1px solid ${C.border}` }}>
      {status ?? '—'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SheetCard
// ---------------------------------------------------------------------------
interface CardProps {
  sheet: RegisteredSheet
  onSync:   (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function SheetCard({ sheet, onSync, onDelete }: CardProps) {
  const [syncing, setSyncing]         = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDelete, setConfirm]   = useState(false)
  const [syncResult, setSyncResult]   = useState<{ok:boolean; msg:string} | null>(null)

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await onSync(sheet.id)
      setSyncResult({ ok: true, msg: 'Sync completado' })
    } catch {
      setSyncResult({ ok: false, msg: 'Error durante el sync' })
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirm(true); return }
    setDeleting(true)
    try { await onDelete(sheet.id) }
    finally { setDeleting(false); setConfirm(false) }
  }

  const promoNumero = (sheet as any).promotions_kpi?.numero ?? null

  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>
            {sheet.sheet_name ?? sheet.promocion_nombre}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {sheet.promocion_nombre && (
              <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:99, fontSize:11, fontWeight:500, background:C.blueLight, color:C.blue, border:`1px solid ${C.blueBdr}` }}>
                {promoNumero ? `#${promoNumero}` : ''} {sheet.promocion_nombre}
              </span>
            )}
            {(sheet as any).group_filter && (
              <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:99, fontSize:11, background:C.bg, color:C.faint, border:`1px solid ${C.border}` }}>
                grupo: {(sheet as any).group_filter}
              </span>
            )}
            <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:99, fontSize:11, background:C.bg, color:C.faint, border:`1px solid ${C.border}` }}>
              {sheet.student_count} alumnos
            </span>
          </div>
        </div>
        <StatusBadge status={(sheet as any).sync_status} />
      </div>

      {/* Link */}
      <a
        href={`https://docs.google.com/spreadsheets/d/${sheet.sheet_id}`}
        target="_blank" rel="noopener noreferrer"
        style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:C.blue }}
      >
        <ExternalLink size={11} /> Abrir en Google Sheets
      </a>

      {/* Sync result */}
      {syncResult && (
        <div style={{
          fontSize:11, padding:'4px 8px', borderRadius:6,
          background: syncResult.ok ? C.greenBg : C.redBg,
          color:      syncResult.ok ? C.green   : C.red,
          border: `1px solid ${syncResult.ok ? C.greenBdr : C.redBdr}`,
        }}>
          {syncResult.msg}
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', alignItems:'center', gap:6, borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
        <button
          onClick={handleSync} disabled={syncing}
          style={{
            display:'inline-flex', alignItems:'center', gap:4,
            padding:'5px 10px', borderRadius:6,
            border:`1px solid ${C.blueBdr}`, background:C.blueLight,
            color:C.blue, fontSize:11, fontWeight:500,
            cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1,
          }}
        >
          {syncing
            ? <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }} />
            : <RefreshCw size={11} />}
          Sync
        </button>

        {confirmDelete ? (
          <>
            <button onClick={handleDelete} disabled={deleting} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, border:'none', background:C.red, color:'#fff', fontSize:11, fontWeight:600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
              {deleting ? <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }} /> : null}
              Confirmar
            </button>
            <button onClick={() => setConfirm(false)} style={{ padding:'5px 8px', borderRadius:6, border:`1px solid ${C.border}`, background:C.white, fontSize:11, color:C.muted, cursor:'pointer' }}>
              Cancelar
            </button>
          </>
        ) : (
          <button onClick={handleDelete} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, border:`1px solid ${C.border}`, background:C.white, fontSize:11, color:C.muted, cursor:'pointer' }}>
            <Trash2 size={11} /> Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DropoutSheetsManager
// ---------------------------------------------------------------------------
export default function DropoutSheetsManager() {
  const [sheets, setSheets]       = useState<RegisteredSheet[]>([])
  const [promos, setPromos]       = useState<PromoOption[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [form, setForm]             = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [s, p] = await Promise.all([getRegisteredSheets(), getActivePromoOptions()])
      setSheets(s)
      setPromos(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSync = async (id: string) => {
    await triggerSheetSync(id)
    await fetchData()
  }

  const handleDelete = async (id: string) => {
    await unregisterSheet(id)
    setSheets((prev) => prev.filter((s) => s.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null); setFormSuccess(false)

    if (!form.sheetUrl.trim())       { setFormError('La URL del sheet es obligatoria.'); return }
    if (!form.promocionNombre.trim()) { setFormError('Seleccioná una promoción.'); return }

    setSubmitting(true)
    try {
      await registerSheet(
        form.sheetUrl.trim(),
        form.promocionNombre,
        form.sheetName.trim() || form.promocionNombre,
        form.groupFilter.trim(),
      )
      setForm(EMPTY_FORM)
      setFormSuccess(true)
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setSubmitting(false)
    }
  }

  // Promos ya vinculadas al final
  const linkedNames  = new Set(sheets.map((s) => (s as any).promocion_nombre).filter(Boolean))
  const sortedPromos = [
    ...promos.filter((p) => !linkedNames.has(p.nombre)),
    ...promos.filter((p) =>  linkedNames.has(p.nombre)),
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'20px 0', color:C.faint, fontSize:13 }}>
        <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} />
        Cargando sheets…
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:8, background:C.redBg, border:`1px solid ${C.redBdr}`, fontSize:13, color:C.red }}>
        <AlertCircle size={14} /> {error}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Lista ────────────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#64748b', marginBottom:10, paddingBottom:4, borderBottom:`1px solid ${C.border}` }}>
          Sheets registrados ({sheets.length})
        </div>

        {sheets.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 16px', borderRadius:10, border:`1px dashed ${C.border}`, background:C.bg, gap:8, textAlign:'center' }}>
            <FileSpreadsheet size={28} color={C.faint} />
            <p style={{ fontSize:13, fontWeight:500, color:C.muted, margin:0 }}>No hay sheets registrados todavía</p>
            <p style={{ fontSize:12, color:C.faint, margin:0 }}>Usá el formulario de abajo para agregar el primero.</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:10 }}>
            {sheets.map((sheet) => (
              <SheetCard key={sheet.id} sheet={sheet} onSync={handleSync} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* ── Formulario ───────────────────────────────────────────────────── */}
      <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:C.text, marginBottom:14 }}>
          <PlusCircle size={14} color={C.blue} />
          Registrar nuevo sheet de abandonos
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* URL */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.muted, marginBottom:4 }}>
              URL del Google Sheet <span style={{ color:C.red }}>*</span>
            </label>
            <input type="url" placeholder="https://docs.google.com/spreadsheets/d/..."
              value={form.sheetUrl}
              onChange={(e) => setForm((p) => ({ ...p, sheetUrl: e.target.value }))}
              style={INPUT_STYLE}
            />
          </div>

          {/* Promo + nombre sheet */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.muted, marginBottom:4 }}>
                Promoción <span style={{ color:C.red }}>*</span>
              </label>
              <select value={form.promocionNombre}
                onChange={(e) => setForm((p) => ({ ...p, promocionNombre: e.target.value, sheetName: p.sheetName || e.target.value }))}
                style={{ ...INPUT_STYLE, cursor:'pointer' }}
              >
                <option value="">— Seleccioná una promo —</option>
                {sortedPromos.map((p) => (
                  <option key={p.nombre} value={p.nombre}>
                    {p.numero ? `#${p.numero} — ` : ''}{p.nombre}{linkedNames.has(p.nombre) ? ' (ya vinculada)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.muted, marginBottom:4 }}>
                Nombre del sheet <span style={{ color:C.faint, fontWeight:400 }}>(opcional)</span>
              </label>
              <input type="text" placeholder="Se usa el nombre de la promo"
                value={form.sheetName}
                onChange={(e) => setForm((p) => ({ ...p, sheetName: e.target.value }))}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* Filtro de grupo */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.muted, marginBottom:4 }}>
              Filtro de grupo <span style={{ color:C.faint, fontWeight:400 }}>(para sheets compartidas entre promos)</span>
            </label>
            <input type="text" placeholder="Ej: 113"
              value={form.groupFilter}
              onChange={(e) => setForm((p) => ({ ...p, groupFilter: e.target.value }))}
              style={INPUT_STYLE}
            />
          </div>

          {/* Feedback */}
          {formError && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:8, background:C.redBg, border:`1px solid ${C.redBdr}`, fontSize:12, color:C.red }}>
              <AlertCircle size={12} /> {formError}
            </div>
          )}
          {formSuccess && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:8, background:C.greenBg, border:`1px solid ${C.greenBdr}`, fontSize:12, color:C.green }}>
              <CheckCircle2 size={12} /> Sheet registrado correctamente.
            </div>
          )}

          {/* Submit */}
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button type="submit" disabled={submitting} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'8px 18px', borderRadius:8, border:'none',
              background: submitting ? '#94a3b8' : C.blue,
              color:'#fff', fontWeight:600, fontSize:13,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
              {submitting
                ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} />
                : <PlusCircle size={13} />}
              Registrar sheet
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
