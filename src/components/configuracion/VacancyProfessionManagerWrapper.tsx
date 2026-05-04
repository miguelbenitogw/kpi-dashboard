import { getTiposProfesional } from '@/lib/queries/atraccion'
import VacancyProfessionManager from './VacancyProfessionManager'

export default async function VacancyProfessionManagerWrapper() {
  const tiposProfesional = await getTiposProfesional()
  return <VacancyProfessionManager tiposProfesional={tiposProfesional} />
}
