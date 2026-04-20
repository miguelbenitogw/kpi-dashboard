import { supabaseAdmin } from '../supabase/server'

interface TokenConfig {
  access_token: string
  expires_at: string
  scope: string
}

interface ZohoTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  api_domain: string
  token_type: string
}

const TOKEN_BUFFER_MS = 5 * 60 * 1000 // 5 minutes before expiry

export async function getAccessToken(): Promise<string> {
  const stored = await getStoredToken()

  if (stored && !isExpired(stored.expires_at)) {
    return stored.access_token
  }

  const fresh = await refreshToken()
  await storeToken(fresh)
  return fresh.access_token
}

async function getStoredToken(): Promise<TokenConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('dashboard_config_kpi')
    .select('config_value')
    .eq('config_key', 'zoho_token')
    .single()

  if (error || !data) return null

  try {
    const parsed =
      typeof data.config_value === 'string'
        ? JSON.parse(data.config_value)
        : data.config_value
    return parsed as TokenConfig
  } catch {
    return null
  }
}

function isExpired(expiresAt: string): boolean {
  const expiryTime = new Date(expiresAt).getTime()
  return Date.now() >= expiryTime - TOKEN_BUFFER_MS
}

async function refreshToken(): Promise<TokenConfig> {
  const tokenUrl = process.env.ZOHO_TOKEN_URL
  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const refreshTokenValue = process.env.ZOHO_REFRESH_TOKEN

  if (!tokenUrl || !clientId || !clientSecret || !refreshTokenValue) {
    throw new Error(
      'Missing Zoho OAuth env vars: ZOHO_TOKEN_URL, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN'
    )
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshTokenValue,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Zoho token refresh failed (${response.status}): ${body}`)
  }

  const data: ZohoTokenResponse = await response.json()

  if (!data.access_token) {
    throw new Error(`Zoho token refresh returned no access_token: ${JSON.stringify(data)}`)
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  return {
    access_token: data.access_token,
    expires_at: expiresAt,
    scope: data.scope || '',
  }
}

async function storeToken(token: TokenConfig): Promise<void> {
  const { error } = await supabaseAdmin
    .from('dashboard_config_kpi')
    .upsert(
      {
        config_key: 'zoho_token',
        config_value: token as Record<string, string>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'config_key' }
    )

  if (error) {
    console.error('Failed to store Zoho token in dashboard_config:', error)
    throw new Error(`Failed to store Zoho token: ${error.message}`)
  }
}
