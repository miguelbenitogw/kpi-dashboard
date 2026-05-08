import AlemaniaPagosView from '@/components/alemania/AlemaniaPagosView'
import { getGermanyPagosFull } from '@/lib/queries/germany'

export default async function AlemaniaPagosPage() {
  const initialData = await getGermanyPagosFull()
  return <AlemaniaPagosView initialData={initialData} />
}
