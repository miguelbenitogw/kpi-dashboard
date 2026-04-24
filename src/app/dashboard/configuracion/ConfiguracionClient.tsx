'use client'

import MadreSheetsManager from '@/components/configuracion/MadreSheetsManager'
import SlaThresholdsManager from '@/components/configuracion/SlaThresholdsManager'

export default function ConfiguracionClient({ section }: { section: 'sheets' | 'sla' }) {
  if (section === 'sheets') return <MadreSheetsManager />
  return <SlaThresholdsManager />
}
