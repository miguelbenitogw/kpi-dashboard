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
} from 'lucide-react'
import {
  getDropoutSheetsAction,
  registerDropoutSheetAction,
  unregisterDropoutSheetAction,
  type DropoutSheet,
} from '@/app/dashboard/configuracion/actions'

// ---------------------------------------------------------------------------
// Colors
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
  blueBorder:'#bfdbfe',
  green:     '#16a34a',
  greenBg:   '#f0fdf4',
  greenBdr:  '#bbf7d0',
  red:       '#dc2626',
  redBg:     '#fef2f2',
  redBdr:    '#fecaca',
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

const PROGRAMAS = ['Noruega', 'Alemania']

const EMPTY_FORM = {
  sheetUrl:    '',
  label:       '',
  programa:    '',
  promoNumero: '',
  tabName:     'Dropouts',
}

// ---------------------------------------------------------------------------
// DropoutSheetCard
// ---------------------------------------------------------------------------
interface CardProps {
  sheet: DropoutSheet
  onDelete: (id: string) => Promise<void>
}

function DropoutSheetCard({ sheet, onDelete }: CardProps) {
  const [deleting, setDeleting]       = useState(false)
  const [confirmDelete, setConfirm]   = useState(false)

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirm(true); return }
    setDeleting(true)
    try {
      await onDelete(sheet.id)
    } finally {
      setDeleting(false)
      setConfirm(false)
    }
  }

  const programaBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: sheet.programa === 'Alemania' ? '#fef3c7' : C.blueLight,
    color:      sheet.programa === 'Alemania' ? '#92400e'  : C.blue,
    border:     `1px solid ${sheet.programa === 'Alemania' ? '#fde68a' : C.blueBorder}`,
  }

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            {sheet.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {sheet.programa && <span style={programaBadgeStyle}>{sheet.programa}</span>}
            {sheet.promo_numero != null && (
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                fontSize: 11, fontWeight: 500, background: C.bg, color: C.muted,
                border: `1px solid ${C.border}`,
              }}>
                Promo {sheet.promo_numero}
              </span>
            )}
            <span style={{
              display: 'inline-block', padding: '2px 8px', borderRadius: 99,
              fontSize: 11, fontWeight: 500, background: C.bg, color: C.faint,
              border: `1px solid ${C.border}`,
            }}>
              Tab: {sheet.tab_name}
            </span>
          </div>
        </div>

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
          padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500,
          background: sheet.is_active ? C.greenBg : C.bg,
          color:      sheet.is_active ? C.green   : C.faint,
          border:     `1px solid ${sheet.is_active ? C.greenBdr : C.border}`,
        }}>
          {sheet.is_active && <CheckCircle2 size={10} />}
          {sheet.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Sheet link */}
      <a
        href={`https://docs.google.com/spreadsheets/d/${sheet.sheet_id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.blue }}
      >
        <ExternalLink size={11} />
        Abrir en Google Sheets
      </a>

      {/* Actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 2,
      }}>
        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: C.red, color: '#fff', fontSize: 11, fontWeight: 600,
                cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Confirmar borrado
            </button>
            <button
              onClick={() => setConfirm(false)}
              style={{
                padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
                background: C.white, fontSize: 11, color: C.muted, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            onClick={handleDelete}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.white, fontSize: 11, color: C.muted, cursor: 'pointer',
            }}
          >
            <Trash2 size={11} />
            Eliminar
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
  const [sheets, setSheets]       = useState<DropoutSheet[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [form, setForm]           = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSheets(await getDropoutSheetsAction())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await unregisterDropoutSheetAction(id)
    setSheets((prev) => prev.filter((s) => s.id !== id))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    if (!form.sheetUrl.trim()) { setFormError('La URL del sheet es obligatoria.'); return }
    if (!form.label.trim())    { setFormError('La etiqueta es obligatoria.'); return }

    setSubmitting(true)
    try {
      await registerDropoutSheetAction({
        sheetUrl:    form.sheetUrl.trim(),
        label:       form.label.trim(),
        programa:    form.programa || null,
        promo_numero: form.promoNumero ? parseInt(form.promoNumero, 10) : null,
        tab_name:    form.tabName.trim() || 'Dropouts',
      })
      setForm(EMPTY_FORM)
      setFormSuccess(true)
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al registrar el sheet')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: C.faint, fontSize: 13 }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        Cargando sheets de abandonos…
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 8,
        background: C.redBg, border: `1px solid ${C.redBdr}`,
        fontSize: 13, color: C.red,
      }}>
        <AlertCircle size={14} />
        {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Lista de sheets registrados ──────────────────────────────────── */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: '#64748b',
          marginBottom: 10, paddingBottom: 4,
          borderBottom: `1px solid ${C.border}`,
        }}>
          Sheets registrados ({sheets.length})
        </div>

        {sheets.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '32px 16px', borderRadius: 10,
            border: `1px dashed ${C.border}`, background: C.bg,
            gap: 8, textAlign: 'center',
          }}>
            <FileSpreadsheet size={28} color={C.faint} />
            <p style={{ fontSize: 13, fontWeight: 500, color: C.muted, margin: 0 }}>
              No hay sheets de abandonos registrados todavía
            </p>
            <p style={{ fontSize: 12, color: C.faint, margin: 0 }}>
              Usá el formulario de abajo para agregar el primero.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {sheets.map((sheet) => (
              <DropoutSheetCard key={sheet.id} sheet={sheet} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* ── Formulario nuevo sheet ──────────────────────────────────────── */}
      <div style={{
        background: C.bg, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: 16,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 600, color: C.text,
          marginBottom: 14,
        }}>
          <PlusCircle size={14} color={C.blue} />
          Registrar sheet de abandonos
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* URL */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>
              URL del Google Sheet <span style={{ color: C.red }}>*</span>
            </label>
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={form.sheetUrl}
              onChange={(e) => setForm((p) => ({ ...p, sheetUrl: e.target.value }))}
              style={INPUT_STYLE}
            />
          </div>

          {/* Label */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>
              Etiqueta <span style={{ color: C.red }}>*</span>
            </label>
            <input
              type="text"
              placeholder='Ej: "Promo 113 – Abandonos"'
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              style={INPUT_STYLE}
            />
          </div>

          {/* Programa + Promo numero */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>
                Programa
              </label>
              <select
                value={form.programa}
                onChange={(e) => setForm((p) => ({ ...p, programa: e.target.value }))}
                style={{ ...INPUT_STYLE, cursor: 'pointer' }}
              >
                <option value="">— sin especificar —</option>
                {PROGRAMAS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>
                Nº Promoción
              </label>
              <input
                type="number"
                placeholder="Ej: 113"
                value={form.promoNumero}
                onChange={(e) => setForm((p) => ({ ...p, promoNumero: e.target.value }))}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* Tab name */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>
              Nombre de la pestaña
            </label>
            <input
              type="text"
              placeholder="Dropouts"
              value={form.tabName}
              onChange={(e) => setForm((p) => ({ ...p, tabName: e.target.value }))}
              style={INPUT_STYLE}
            />
            <p style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
              Nombre exacto de la pestaña dentro del sheet donde están los abandonos. Por defecto: "Dropouts".
            </p>
          </div>

          {/* Feedback */}
          {formError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              background: C.redBg, border: `1px solid ${C.redBdr}`,
              fontSize: 12, color: C.red,
            }}>
              <AlertCircle size={12} />
              {formError}
            </div>
          )}
          {formSuccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              background: C.greenBg, border: `1px solid ${C.greenBdr}`,
              fontSize: 12, color: C.green,
            }}>
              <CheckCircle2 size={12} />
              Sheet registrado correctamente.
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: submitting ? '#94a3b8' : C.blue,
                color: '#fff', fontWeight: 600, fontSize: 13,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
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
