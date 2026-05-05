'use client'

import { useEffect, useState, useCallback } from 'react'
import type { GermanyCandidateCronologia } from '@/lib/queries/germany'

// ---------------------------------------------------------------------------
// Design tokens (warm-light, igual que el resto de Alemania)
// ---------------------------------------------------------------------------
const T = {
  bg: '#f9f7f4',
  card: '#ffffff',
  border: '#e7e2d8',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#1e4b9e',
  orange: '#e55a2b',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function estadoBadge(estado: string | null): { bg: string; color: string } {
  if (!estado) return { bg: '#f5f1ea', color: T.muted }
  const e = estado.toLowerCase()
  if (e.includes('hired')) return { bg: '#dcfce7', color: '#16a34a' }
  if (e.includes('in training') || e.includes('standby') || e.includes('stand by'))
    return { bg: '#dbeafe', color: '#1d4ed8' }
  if (e.includes('to place') || e.includes('iqz') || e.includes('berlín') || e.includes('berlin'))
    return { bg: '#fef3c7', color: '#d97706' }
  if (e.includes('fuera') || e.includes('withdrawn') || e.includes('expelled') || e.includes('declined'))
    return { bg: '#fee2e2', color: '#dc2626' }
  return { bg: '#f5f1ea', color: '#57534e' }
}

function vacancyStatusChip(status: string | null) {
  const badge = estadoBadge(status)
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '99px',
        fontSize: '11px',
        fontWeight: 600,
        background: badge.bg,
        color: badge.color,
        whiteSpace: 'nowrap',
      }}
    >
      {status ?? '—'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonLine({ width = '100%', height = 14 }: { width?: string; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: 'linear-gradient(90deg, #ede8e0 25%, #f5f1ea 50%, #ede8e0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

function DrawerSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {/* Header skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SkeletonLine width="60%" height={22} />
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonLine width="80px" height={20} />
          <SkeletonLine width="100px" height={20} />
        </div>
      </div>
      {/* Vacancies skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SkeletonLine width="30%" height={13} />
        {[1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <SkeletonLine width="60%" height={13} />
            <SkeletonLine width="80px" height={13} />
          </div>
        ))}
      </div>
      {/* Timeline skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SkeletonLine width="30%" height={13} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <SkeletonLine width="28px" height={28} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonLine width="80%" height={13} />
              <SkeletonLine width="40%" height={11} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline item types
// ---------------------------------------------------------------------------

type TimelineStageItem = {
  kind: 'stage'
  date: string
  job_opening_title: string
  from_status: string | null
  to_status: string
}

type TimelineNoteItem = {
  kind: 'note'
  date: string
  note_title: string | null
  note_content: string | null
  note_owner: string | null
}

type TimelineItem = TimelineStageItem | TimelineNoteItem

// ---------------------------------------------------------------------------
// Note content with expand
// ---------------------------------------------------------------------------

function NoteContent({ content }: { content: string | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!content) return <span style={{ color: T.muted, fontSize: 12 }}>Sin contenido</span>

  const lines = content.split('\n')
  const isTruncated = lines.length > 3 || content.length > 200

  const displayText =
    expanded || !isTruncated ? content : lines.slice(0, 3).join('\n').slice(0, 200) + (isTruncated ? '…' : '')

  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: T.text,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {displayText}
      </p>
      {isTruncated && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: T.accent,
            fontSize: 11,
            fontWeight: 600,
            padding: 0,
          }}
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  zohoId: string | null
  candidateName?: string | null
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GermanyCandidateDrawer({ zohoId, candidateName, onClose }: Props) {
  const [data, setData] = useState<GermanyCandidateCronologia | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOpen = zohoId !== null

  // Fetch when zohoId changes
  useEffect(() => {
    if (!zohoId) {
      setData(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/germany/candidates/${zohoId}/cronologia`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json: GermanyCandidateCronologia) => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? 'Error desconocido')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [zohoId])

  // Escape key closes drawer
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    },
    [isOpen, onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Build combined timeline
  const timeline: TimelineItem[] = []
  if (data) {
    for (const s of data.stage_history) {
      timeline.push({ kind: 'stage', date: s.changed_at, ...s })
    }
    for (const n of data.notes) {
      timeline.push({
        kind: 'note',
        date: n.created_at ?? '',
        note_title: n.note_title,
        note_content: n.note_content,
        note_owner: n.note_owner,
      })
    }
    // Sort by date DESC
    timeline.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return db - da
    })
  }

  const candidate = data?.candidate
  const promoBadge = candidate?.promo_numero != null ? `#${candidate.promo_numero}` : null
  const estadoBdg = estadoBadge(candidate?.estado ?? null)

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(28,25,23,0.35)',
          zIndex: 50,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 220ms ease',
        }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cronología de ${candidateName ?? 'candidato'}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(480px, 100vw)',
          background: T.bg,
          borderLeft: `1px solid ${T.border}`,
          boxShadow: '-4px 0 24px rgba(28,25,23,0.10)',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 260ms cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
        }}
      >
        {/* Sticky header bar */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: T.bg,
            borderBottom: `1px solid ${T.border}`,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Cronología del candidato
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.muted,
              fontSize: 20,
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        {!isOpen ? null : loading ? (
          <DrawerSkeleton />
        ) : error ? (
          <div style={{ padding: 24, color: '#dc2626', fontSize: 13 }}>
            Error cargando la cronología: {error}
          </div>
        ) : !data ? null : (
          <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 1. Header — nombre, promo, estado */}
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <h2
                style={{
                  margin: '0 0 10px',
                  fontSize: 17,
                  fontWeight: 700,
                  color: T.text,
                  lineHeight: 1.3,
                }}
              >
                {candidate?.nombre ?? candidateName ?? 'Sin nombre'}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {promoBadge && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#dbeafe',
                      color: T.accent,
                    }}
                  >
                    Promo {promoBadge}
                  </span>
                )}
                {candidate?.tipo_perfil && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 500,
                      background: '#f5f1ea',
                      color: '#57534e',
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    {candidate.tipo_perfil}
                  </span>
                )}
                {candidate?.estado && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 600,
                      background: estadoBdg.bg,
                      color: estadoBdg.color,
                    }}
                  >
                    {candidate.estado}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Vacantes */}
            <section>
              <h3
                style={{
                  margin: '0 0 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: T.muted,
                }}
              >
                Vacantes
              </h3>
              {data.vacancies.length === 0 ? (
                <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Sin vacantes registradas</p>
              ) : (
                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  {data.vacancies.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 14px',
                        borderBottom: i < data.vacancies.length - 1 ? `1px solid ${T.border}` : 'none',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: T.text,
                          fontWeight: 500,
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={v.job_opening_title}
                      >
                        {v.job_opening_title}
                      </span>
                      <div style={{ flexShrink: 0 }}>
                        {vacancyStatusChip(v.candidate_status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Timeline combinada */}
            <section>
              <h3
                style={{
                  margin: '0 0 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: T.muted,
                }}
              >
                Historial
              </h3>

              {timeline.length === 0 ? (
                <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Sin cronología registrada</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {timeline.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 12,
                        paddingBottom: i < timeline.length - 1 ? 16 : 0,
                        position: 'relative',
                      }}
                    >
                      {/* Vertical line */}
                      {i < timeline.length - 1 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 13,
                            top: 28,
                            bottom: 0,
                            width: 2,
                            background: T.border,
                            zIndex: 0,
                          }}
                        />
                      )}

                      {/* Icon */}
                      <div
                        style={{
                          flexShrink: 0,
                          width: 28,
                          height: 28,
                          borderRadius: 99,
                          background: item.kind === 'stage' ? '#dbeafe' : '#fff7ed',
                          border: `2px solid ${item.kind === 'stage' ? '#93c5fd' : '#fed7aa'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          zIndex: 1,
                          position: 'relative',
                        }}
                      >
                        {item.kind === 'stage' ? '→' : '✎'}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {item.kind === 'stage' ? (
                          <>
                            <p
                              style={{
                                margin: '0 0 2px',
                                fontSize: 12,
                                color: T.muted,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={item.job_opening_title}
                            >
                              {item.job_opening_title}
                            </p>
                            <p style={{ margin: '0 0 4px', fontSize: 13, color: T.text, fontWeight: 500 }}>
                              {item.from_status ? (
                                <>
                                  <span style={{ color: T.muted }}>{item.from_status}</span>
                                  {' → '}
                                  <span style={{ color: T.accent, fontWeight: 600 }}>{item.to_status}</span>
                                </>
                              ) : (
                                <span style={{ color: T.accent, fontWeight: 600 }}>{item.to_status}</span>
                              )}
                            </p>
                            <span style={{ fontSize: 11, color: T.muted }}>{formatDate(item.date)}</span>
                          </>
                        ) : (
                          <>
                            <p style={{ margin: '0 0 4px', fontSize: 13, color: T.text, fontWeight: 600 }}>
                              {item.note_title ?? 'Nota'}
                            </p>
                            <NoteContent content={item.note_content} />
                            <p style={{ margin: '6px 0 0', fontSize: 11, color: T.muted }}>
                              {item.note_owner && <span>{item.note_owner} · </span>}
                              {formatDate(item.date)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  )
}
