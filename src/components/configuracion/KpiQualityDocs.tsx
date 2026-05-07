/**
 * KpiQualityDocs — read-only documentation panel for the two quality KPIs.
 *
 * Ratio 1: ratio_exito_contactados
 *   (Hired + Approved by client + In Training)
 *   / (total − Associated − Not Valid − No Answer − Rejected by client − New)
 *
 * Ratio 2: ratio_descarte
 *   (No Answer + Not Valid + Rejected by client + Rejected) / total
 */

const S = {
  wrap: {
    background: '#f9f7f4',
    border: '1px solid #e7e2d8',
    borderRadius: 14,
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1c1917',
    marginBottom: 16,
  },
  ratioBlock: {
    background: '#ffffff',
    border: '1px solid #e7e2d8',
    borderRadius: 10,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  ratioTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1c1917',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#78716c',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  tagGreen: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 6,
    background: '#dcfce7',
    color: '#15803d',
    border: '1px solid #bbf7d0',
  },
  tagRed: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 6,
    background: '#fee2e2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },
  tagGray: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 6,
    background: '#f5f5f4',
    color: '#78716c',
    border: '1px solid #e7e2d8',
  },
  tagAmber: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 6,
    background: '#fef3c7',
    color: '#b45309',
    border: '1px solid #fde68a',
  },
  formula: {
    fontSize: 12,
    color: '#78716c',
    fontFamily: 'monospace',
    background: '#f5f5f4',
    borderRadius: 6,
    padding: '6px 10px',
    lineHeight: 1.5,
  },
  unclassifiedLabel: {
    fontSize: 11,
    color: '#78716c',
    lineHeight: 1.6,
  },
  divider: {
    height: 1,
    background: '#e7e2d8',
    border: 'none',
    margin: 0,
  },
}

export default function KpiQualityDocs() {
  return (
    <div style={S.wrap}>
      <div style={S.title}>Configuración de KPIs de calidad</div>

      {/* ── Ratio 1 ── */}
      <div style={S.ratioBlock}>
        <div style={S.ratioTitle}>Ratio 1 — Éxito sobre contactados reales</div>
        <div style={S.formula}>
          (Hired + Approved by client + In Training){'\n'}
          ──────────────────────────────────────────────{'\n'}
          total − (Associated + Not Valid + No Answer + Rejected by client + New)
        </div>
        <div>
          <div style={S.sectionLabel}>Numerador — positivos</div>
          <div style={S.tagList}>
            <span style={S.tagGreen}>Hired</span>
            <span style={S.tagGreen}>Approved by client</span>
            <span style={S.tagGreen}>In Training</span>
          </div>
        </div>
        <div>
          <div style={S.sectionLabel}>Excluidos del denominador</div>
          <div style={S.tagList}>
            <span style={S.tagGray}>Associated</span>
            <span style={S.tagGray}>Not Valid</span>
            <span style={S.tagRed}>No Answer</span>
            <span style={S.tagRed}>Rejected by client</span>
            <span style={S.tagGray}>New</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#78716c' }}>
          Si el denominador es 0 → el ratio no se muestra (NULL).
          Colores: <strong style={{ color: '#16a34a' }}>verde ≥ 30%</strong>,{' '}
          <strong style={{ color: '#d97706' }}>ámbar ≥ 15%</strong>,{' '}
          <strong style={{ color: '#dc2626' }}>rojo &lt; 15%</strong>.
        </div>
      </div>

      {/* ── Ratio 2 ── */}
      <div style={S.ratioBlock}>
        <div style={S.ratioTitle}>Ratio 2 — Descarte / ruido</div>
        <div style={S.formula}>
          (No Answer + Not Valid + Rejected by client + Rejected){'\n'}
          ─────────────────────────────────────────────────────────{'\n'}
          total
        </div>
        <div>
          <div style={S.sectionLabel}>Numerador — descartados</div>
          <div style={S.tagList}>
            <span style={S.tagRed}>No Answer</span>
            <span style={S.tagRed}>Not Valid</span>
            <span style={S.tagRed}>Rejected by client</span>
            <span style={S.tagRed}>Rejected</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#78716c' }}>
          Si total es 0 → el ratio no se muestra (NULL).
          Colores: <strong style={{ color: '#dc2626' }}>rojo ≥ 50%</strong>,{' '}
          <strong style={{ color: '#d97706' }}>ámbar ≥ 30%</strong>,{' '}
          <strong style={{ color: '#78716c' }}>gris &lt; 30%</strong>.
        </div>
      </div>

      {/* ── Sin clasificar ── */}
      <div>
        <div style={S.sectionLabel}>Estados sin clasificar (no afectan ningún ratio)</div>
        <div style={S.tagList}>
          {[
            'No Show', 'Expelled', 'Offer-Declined', 'Offer-Withdrawn',
            'Transferred', 'To Place', 'Assigned', 'Training Finished',
            'Stand-by', 'On Hold', 'First Call', 'Second Call',
            'Check Interest', 'Next Project', 'Interview-Scheduled',
            'Interview to be Scheduled', 'Waiting for Consensus',
            'Waiting for Evaluation', 'In Training out of GW',
            'Rejected for Interview',
          ].map((s) => (
            <span key={s} style={S.tagGray}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
