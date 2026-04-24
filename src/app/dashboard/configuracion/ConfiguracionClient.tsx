'use client'

import dynamic from 'next/dynamic'

const MadreSheetsManager = dynamic(
  () => import('@/components/configuracion/MadreSheetsManager'),
  { ssr: false }
)

const SlaThresholdsManager = dynamic(
  () => import('@/components/configuracion/SlaThresholdsManager'),
  { ssr: false }
)

export default function ConfiguracionClient({ section }: { section: 'sheets' | 'sla' }) {
  if (section === 'sheets') return <MadreSheetsManager />
  return <SlaThresholdsManager />
}
