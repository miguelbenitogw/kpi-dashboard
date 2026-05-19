import { getVacacionesHoy, getPlacementHoy } from '@/lib/queries/equipo-hoy'

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  bg: '#faf9f7',
  card: '#ffffff',
  border: '#e7e2d8',
  text: '#1c1917',
  muted: '#78716c',
  mutedLight: '#a8a29e',
  online: '#8e7cc3',
  onlineBg: '#f0ecfb',
  presencial: '#d97706',
  presencialBg: '#fef3c7',
  holiday: '#46bdc6',
  holidayBg: '#e0f7f8',
}

function formatTime(t: string | null): string {
  if (!t) return ''
  // If already HH:MM strip seconds
  return t.slice(0, 5)
}

function timeRange(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  if (start && end) return `${formatTime(start)}–${formatTime(end)}`
  if (start) return `desde ${formatTime(start)}`
  return ''
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

export default async function EquipoHoyWidget() {
  const [vacaciones, placement] = await Promise.all([
    getVacacionesHoy(),
    getPlacementHoy(),
  ])

  const presencial = placement.filter(
    (p) => p.modality?.toLowerCase() === 'presencial' && p.status?.toLowerCase() !== 'holiday',
  )
  const online = placement.filter(
    (p) => p.modality?.toLowerCase() === 'online' && p.status?.toLowerCase() !== 'holiday',
  )
  const holiday = placement.filter((p) => p.status?.toLowerCase() === 'holiday')

  const hasPlacement = presencial.length > 0 || online.length > 0 || holiday.length > 0

  return (
    <section>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 2,
            background: '#57534e',
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#57534e' }}>
          ¿Quién está hoy?
        </span>
        <span style={{ fontSize: 12, color: P.muted, marginLeft: 4 }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* ── Card: De vacaciones hoy ──────────────────────────────────────── */}
        <div
          style={{
            background: P.card,
            border: `1px solid ${P.border}`,
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>🏖️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: P.text }}>
              De vacaciones hoy
            </span>
            {vacaciones.length > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#dbeafe',
                  color: '#1e4b9e',
                  borderRadius: 99,
                  padding: '1px 8px',
                }}
              >
                {vacaciones.length}
              </span>
            )}
          </div>

          {vacaciones.length === 0 ? (
            <p style={{ fontSize: 13, color: P.mutedLight, fontStyle: 'italic' }}>
              Nadie de vacaciones hoy
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {vacaciones.map((v, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    background: '#dbeafe',
                    color: '#1e4b9e',
                    borderRadius: 99,
                    padding: '3px 10px',
                  }}
                >
                  {firstName(v.member_name)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Card: Placement hoy ──────────────────────────────────────────── */}
        <div
          style={{
            background: P.card,
            border: `1px solid ${P.border}`,
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: P.text }}>
              Placement hoy
            </span>
            {hasPlacement && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#f0ecfb',
                  color: P.online,
                  borderRadius: 99,
                  padding: '1px 8px',
                }}
              >
                {presencial.length + online.length + holiday.length}
              </span>
            )}
          </div>

          {!hasPlacement ? (
            <p style={{ fontSize: 13, color: P.mutedLight, fontStyle: 'italic' }}>
              Sin horarios para hoy
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Presencial */}
              {presencial.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <span style={{ fontSize: 13 }}>🏢</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: P.presencial,
                      }}
                    >
                      Presencial
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {presencial.map((p, i) => {
                      const range1 = timeRange(p.time_start, p.time_end)
                      const range2 = timeRange(p.time_start_2, p.time_end_2)
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: P.presencial,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 500, color: P.text }}>
                            {firstName(p.member_name)}
                          </span>
                          {range1 && (
                            <span style={{ color: P.muted, fontSize: 11 }}>{range1}</span>
                          )}
                          {range2 && (
                            <span style={{ color: P.muted, fontSize: 11 }}>· {range2}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Online */}
              {online.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <span style={{ fontSize: 13 }}>💻</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: P.online,
                      }}
                    >
                      Online
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {online.map((p, i) => {
                      const range1 = timeRange(p.time_start, p.time_end)
                      const range2 = timeRange(p.time_start_2, p.time_end_2)
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: P.online,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 500, color: P.text }}>
                            {firstName(p.member_name)}
                          </span>
                          {range1 && (
                            <span style={{ color: P.muted, fontSize: 11 }}>{range1}</span>
                          )}
                          {range2 && (
                            <span style={{ color: P.muted, fontSize: 11 }}>· {range2}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Holiday */}
              {holiday.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {holiday.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>🎉</span>
                      <span style={{ color: P.holiday, fontWeight: 500 }}>
                        Holiday: {firstName(p.member_name)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
