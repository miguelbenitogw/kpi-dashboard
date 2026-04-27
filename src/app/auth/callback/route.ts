import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'
import { isEmailAllowed } from '@/lib/auth/config'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/dashboard'
  const origin = url.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`)
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isEmailAllowed(user?.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/auth/login?error=email_not_allowed`)
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const hasVerifiedTotp = (factorsData?.totp?.length ?? 0) > 0

  if (!hasVerifiedTotp) {
    return NextResponse.redirect(`${origin}/auth/mfa`)
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const needsMfaChallenge = aalData?.currentLevel !== 'aal2'

  if (needsMfaChallenge) {
    return NextResponse.redirect(`${origin}/auth/mfa`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
