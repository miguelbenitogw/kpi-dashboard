import { NextResponse } from 'next/server'

export function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.SYNC_API_KEY
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized: Invalid or missing API key' },
    { status: 401 }
  )
}
