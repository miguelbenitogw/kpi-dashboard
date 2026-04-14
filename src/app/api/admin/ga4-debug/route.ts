import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base64Key = process.env.GA4_SERVICE_ACCOUNT_KEY ?? ''
  const propertyId = process.env.GA4_PROPERTY_ID ?? 'NOT SET'

  let decoded: Record<string, unknown> = {}
  try {
    const json = Buffer.from(base64Key, 'base64').toString('utf-8')
    decoded = JSON.parse(json)
  } catch (e) {
    decoded = { error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({
    propertyId,
    keyLength: base64Key.length,
    clientEmail: decoded.client_email ?? 'NOT FOUND',
    hasPrivateKey: !!decoded.private_key,
    projectId: decoded.project_id ?? 'NOT FOUND',
    keysPresent: Object.keys(decoded).slice(0, 10),
  })
}
