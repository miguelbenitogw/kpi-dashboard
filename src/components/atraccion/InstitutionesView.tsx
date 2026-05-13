'use client'

import { useEffect, useState, useMemo } from 'react'
import { Building2, ChevronDown, ChevronRight, Mail, Phone, MapPin, Users, BookOpen, ExternalLink } from 'lucide-react'
import {
  getInstitutions,
  type Institution,
  type InstitutionSummary,
  INSTITUCION_PROFESIONES,
  type InstitucionProfesion,
} from '@/lib/queries/instituciones'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string | null }) {
  if (!estado) return <span style={{ color: '#a8a29e', fontSize: 11 }}>—</span>

  const lower = estado.toLowerCase()
  let bg = '#f1f5f9'
  let color = '#64748b'

  if (lower.includes('sí') || lower === 'si' || lower.includes('realizada') || lower.includes('hecha')) {
    bg = '#dcfce7'; color = '#16a34a'
  } else if (lower.includes('no') || lower.includes('rechaz') || lower.includes('imposible')) {
    bg = '#fee2e2'; color = '#dc2626'
  } else if (lower.includes('pendiente') || lower.includes('contactar') || lower.includes('interesad')) {
    bg = '#fef9c3'; color = '#ca8a04'
  } else if (lower.includes('agenda') || lower.includes('programad')) {
    bg = '#dbeafe'; color = '#1d4ed8'
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 500,
      background: bg,
      color,
      whiteSpace: 'nowrap',
      maxWidth: 160,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {estado}
    </span>
  )
}

function ContactsCell({ contacts, expanded, onToggle }: {
  contacts: Institution['contacts']
  expanded: boolean
  onToggle: () => void
}) {
  if (!contacts.length) return <span style={{ color: '#a8a29e', fontSize: 11 }}>—</span>

  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#1e4b9e', fontSize: 11, fontWeight: 500, padding: 0,
        }}
      >
        <Users size={11} />
        {contacts.length} contacto{contacts.length !== 1 ? 's' : ''}
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function InstitutionRow({ inst }: { inst: Institution }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr style={{ borderBottom: '1px solid #f1f0ec' }}>
        {/* Universidad */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
          <div style={{ fontWeight: 500, fontSize: 12, color: '#1c1917', lineHeight: 1.4 }}>
            {inst.universidad}
          </div>
          {inst.tipo_centro && (
            <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 1 }}>{inst.tipo_centro}</div>
          )}
          {inst.web && (
            <a
              href={inst.web.startsWith('http') ? inst.web : `https://${inst.web}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: '#1e4b9e', display: 'inline-flex', alignItems: 'center', gap: 2, marginTop: 1, textDecoration: 'none' }}
            >
              <ExternalLink size={9} /> web
            </a>
          )}
        </td>

        {/* Comunidad */}
        <td style={{ padding: '8px 12px', fontSize: 11, color: '#57534e', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} style={{ flexShrink: 0, color: '#a8a29e' }} />
            {inst.comunidad_autonoma ?? '—'}
          </div>
          {inst.ciudad && (
            <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 1, marginLeft: 14 }}>{inst.ciudad}</div>
          )}
        </td>

        {/* Estado */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
          <EstadoBadge estado={inst.estado_charla} />
          {inst.ticker_estado && (
            <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 3 }}>{inst.ticker_estado}</div>
          )}
        </td>

        {/* Última charla */}
        <td style={{ padding: '8px 12px', fontSize: 11, color: '#57534e', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
          {inst.fecha_ultima_charla
            ? new Date(inst.fecha_ultima_charla).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
          {inst.tipo_evento_ultima_charla && (
            <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 1 }}>{inst.tipo_evento_ultima_charla}</div>
          )}
        </td>

        {/* Email / Teléfono */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
          {inst.email_facultad ? (
            <a
              href={`mailto:${inst.email_facultad}`}
              style={{ fontSize: 11, color: '#1e4b9e', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              <Mail size={10} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                {inst.email_facultad}
              </span>
            </a>
          ) : (
            <span style={{ color: '#a8a29e', fontSize: 11 }}>—</span>
          )}
          {inst.telefono_facultad && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Phone size={10} style={{ color: '#a8a29e', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#57534e' }}>{inst.telefono_facultad}</span>
            </div>
          )}
        </td>

        {/* Plazas */}
        <td style={{ padding: '8px 12px', fontSize: 11, color: '#57534e', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {inst.plazas_anio != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
              <BookOpen size={10} style={{ color: '#a8a29e' }} />
              {inst.plazas_anio.toLocaleString('es-ES')}
            </div>
          ) : '—'}
          {inst.alumnos_registrados_zoho != null && (
            <div style={{ fontSize: 10, color: '#1e4b9e', textAlign: 'right', marginTop: 1 }}>
              {inst.alumnos_registrados_zoho} en Zoho
            </div>
          )}
        </td>

        {/* Contactos */}
        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
          <ContactsCell
            contacts={inst.contacts}
            expanded={expanded}
            onToggle={() => setExpanded(v => !v)}
          />
        </td>
      </tr>

      {/* Expanded contacts */}
      {expanded && inst.contacts.length > 0 && (
        <tr style={{ background: '#fafaf9', borderBottom: '1px solid #f1f0ec' }}>
          <td colSpan={7} style={{ padding: '6px 24px 10px 40px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {inst.contacts.map(c => (
                <div
                  key={c.contact_number}
                  style={{
                    background: '#fff',
                    border: '1px solid #e7e2d8',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    minWidth: 160,
                    maxWidth: 240,
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#1c1917', marginBottom: 2 }}>
                    Contacto {c.contact_number}
                    {c.nombre_cargo && (
                      <span style={{ fontWeight: 400, color: '#78716c', marginLeft: 4 }}>— {c.nombre_cargo}</span>
                    )}
                  </div>
                  {c.contacto && (
                    <div style={{ color: '#57534e', wordBreak: 'break-word' }}>{c.contacto}</div>
                  )}
                  {c.feedback && (
                    <div style={{ color: '#78716c', fontStyle: 'italic', marginTop: 2, borderTop: '1px solid #f1f0ec', paddingTop: 2 }}>
                      {c.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InstitutionesView() {
  const [data, setData] = useState<InstitutionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [profesionFilter, setProfesionFilter] = useState<InstitucionProfesion | 'todas'>('todas')
  const [comunidadFilter, setComunidadFilter] = useState<string>('todas')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    getInstitutions()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.institutions.filter(inst => {
      if (profesionFilter !== 'todas' && inst.profesion !== profesionFilter) return false
      if (comunidadFilter !== 'todas' && inst.comunidad_autonoma !== comunidadFilter) return false
      if (estadoFilter !== 'todos' && inst.estado_charla !== estadoFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !inst.universidad.toLowerCase().includes(q) &&
          !(inst.ciudad ?? '').toLowerCase().includes(q) &&
          !(inst.comunidad_autonoma ?? '').toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [data, profesionFilter, comunidadFilter, estadoFilter, search])

  // ── Loading / Error ──
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: '#78716c', fontSize: 13 }}>
        <Building2 size={16} style={{ marginRight: 8, color: '#a8a29e' }} />
        Cargando instituciones…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px 0', color: '#dc2626', fontSize: 13 }}>
        Error al cargar instituciones: {error}
      </div>
    )
  }

  // ── Summary bar ──
  const totalFiltered = filtered.length
  const totalAll = data.institutions.length

  return (
    <div className="space-y-4">

      {/* ─── Stats by profesión ─── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {INSTITUCION_PROFESIONES.map(prof => {
          const count = data.byProfesion[prof] ?? 0
          const active = profesionFilter === prof
          return (
            <button
              key={prof}
              onClick={() => setProfesionFilter(active ? 'todas' : prof)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                background: active ? '#1e4b9e' : '#ffffff',
                color: active ? '#ffffff' : '#57534e',
                border: `1px solid ${active ? '#1e4b9e' : '#e7e2d8'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {prof}
              <span style={{
                background: active ? 'rgba(255,255,255,0.25)' : '#f1f0ec',
                color: active ? '#ffffff' : '#78716c',
                borderRadius: 99,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 600,
              }}>
                {count}
              </span>
            </button>
          )
        })}
        {profesionFilter !== 'todas' && (
          <button
            onClick={() => setProfesionFilter('todas')}
            style={{
              padding: '5px 10px', borderRadius: 8, fontSize: 11,
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca', cursor: 'pointer',
            }}
          >
            ✕ quitar filtro
          </button>
        )}
      </div>

      {/* ─── Filter row ─── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Buscar universidad, ciudad…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 8,
            color: '#1c1917',
            fontSize: 12,
            padding: '6px 12px',
            width: 220,
            outline: 'none',
          }}
        />

        {/* Comunidad */}
        <select
          value={comunidadFilter}
          onChange={e => setComunidadFilter(e.target.value)}
          style={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 8,
            color: '#1c1917',
            fontSize: 12,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          <option value="todas">Todas las comunidades</option>
          {data.comunidades.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Estado charla */}
        <select
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
          style={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 8,
            color: '#1c1917',
            fontSize: 12,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          <option value="todos">Todos los estados</option>
          {data.estadosCharla.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        {/* Result count */}
        <span style={{ fontSize: 11, color: '#a8a29e', marginLeft: 4 }}>
          {totalFiltered === totalAll
            ? `${totalAll} instituciones`
            : `${totalFiltered} de ${totalAll}`}
        </span>
      </div>

      {/* ─── Table ─── */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e7e2d8' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#faf9f7', borderBottom: '1px solid #e7e2d8' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Universidad</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Comunidad / Ciudad</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Estado charla</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Última charla</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Contacto facultad</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Plazas/año</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#78716c', fontSize: 11, whiteSpace: 'nowrap' }}>Contactos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#a8a29e', fontSize: 13 }}>
                  No hay instituciones con los filtros aplicados
                </td>
              </tr>
            ) : (
              filtered.map(inst => (
                <InstitutionRow key={inst.id} inst={inst} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
