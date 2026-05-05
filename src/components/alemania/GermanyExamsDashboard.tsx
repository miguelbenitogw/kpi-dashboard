'use client'

import { useState, useRef, useEffect } from 'react'
import type { GermanyExamRow, GermanyCandidateRow } from '@/lib/queries/germany'
import GermanyExamsTable from './GermanyExamsTable'
import GermanyCandidatesTable from './GermanyCandidatesTable'
import GermanyCandidateDrawer from './GermanyCandidateDrawer'

interface Props {
  exams: GermanyExamRow[]
  initialCandidates: {
    rows: GermanyCandidateRow[]
    total: number
  }
  filterOptions: {
    promos: number[]
    tiposPerfil: string[]
    estados: string[]
    profesiones: string[]
  }
}

const SECTION_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e7e2d8',
  borderRadius: '14px',
  padding: '20px 24px',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: '#1c1917',
}

const SECTION_SUB_STYLE: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '12px',
  color: '#78716c',
}

export default function GermanyExamsDashboard({
  exams,
  initialCandidates,
  filterOptions,
}: Props) {
  const [selectedPromo, setSelectedPromo] = useState<number | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [selectedCandidateName, setSelectedCandidateName] = useState<string | null>(null)
  const candidatesRef = useRef<HTMLDivElement>(null)

  // Scroll suave hacia candidatos cuando se selecciona una promo
  useEffect(() => {
    if (selectedPromo != null) {
      candidatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedPromo])

  function handlePromoClick(promo: number | null) {
    setSelectedPromo(promo)
  }

  function handleClearExternalPromo() {
    setSelectedPromo(null)
  }

  function handleCandidateClick(zohoId: string, nombre: string | null) {
    setSelectedCandidateId(zohoId)
    setSelectedCandidateName(nombre)
  }

  return (
    <>
      {/* Tabla de promos / exámenes */}
      <section style={SECTION_STYLE}>
        <h2 style={SECTION_TITLE_STYLE}>Promos · Exámenes</h2>
        <p style={SECTION_SUB_STYLE}>
          Resumen por promoción desde germany_exams_kpi, ordenado por promo más reciente.
          {selectedPromo != null && (
            <span style={{ color: '#e55a2b', marginLeft: '8px', fontWeight: 500 }}>
              · Promo #{selectedPromo} seleccionada
            </span>
          )}
        </p>
        <GermanyExamsTable
          rows={exams}
          selectedPromo={selectedPromo}
          onPromoClick={handlePromoClick}
        />
      </section>

      {/* Candidatos */}
      <section style={SECTION_STYLE} ref={candidatesRef}>
        <h2 style={SECTION_TITLE_STYLE}>Candidatos</h2>
        <p style={SECTION_SUB_STYLE}>
          {initialCandidates.total} candidatos en total · 50 por página
        </p>
        <GermanyCandidatesTable
          initialRows={initialCandidates.rows}
          initialTotal={initialCandidates.total}
          promos={filterOptions.promos}
          tiposPerfil={filterOptions.tiposPerfil}
          estados={filterOptions.estados}
          profesiones={filterOptions.profesiones}
          externalPromo={selectedPromo}
          onClearExternalPromo={handleClearExternalPromo}
          onCandidateClick={handleCandidateClick}
        />
      </section>

      <GermanyCandidateDrawer
        zohoId={selectedCandidateId}
        candidateName={selectedCandidateName}
        onClose={() => setSelectedCandidateId(null)}
      />
    </>
  )
}
