import { NextRequest, NextResponse } from 'next/server'
import { getGermanyCandidates } from '@/lib/queries/germany'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const promoNumeroRaw = searchParams.get('promoNumero')
  const tipoPerfil = searchParams.get('tipoPerfil') ?? undefined
  const estado = searchParams.get('estado') ?? undefined

  const promoNumero =
    promoNumeroRaw ? parseInt(promoNumeroRaw, 10) : undefined

  const result = await getGermanyCandidates({
    page,
    pageSize,
    promoNumero: isNaN(promoNumero ?? NaN) ? undefined : promoNumero,
    tipoPerfil,
    estado,
  })

  return NextResponse.json(result)
}
