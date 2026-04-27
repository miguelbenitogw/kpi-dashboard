import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isPublicPath(pathname: string): boolean {
  return pathname.startsWith('/auth')
}

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith('/api')) return false
  if (pathname.startsWith('/_next')) return false
  if (pathname === '/favicon.ico') return false
  if (pathname.startsWith('/auth')) return false
  return true
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = request.nextUrl.pathname
  const loginUrl = new URL('/auth/login', request.url)
  const dashboardUrl = new URL('/dashboard', request.url)
  const mfaUrl = new URL('/auth/mfa', request.url)

  const needsAuth = isProtectedPath(pathname)
  if (!session && needsAuth) {
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (!session) return response

  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const hasVerifiedTotp = (factorsData?.totp?.length ?? 0) > 0

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const needsMfaChallenge = hasVerifiedTotp && aalData?.currentLevel !== 'aal2'
  const needsMfaEnrollment = !hasVerifiedTotp
  const mfaRequired = needsMfaChallenge || needsMfaEnrollment

  if (pathname === '/auth/mfa' && !mfaRequired) {
    return NextResponse.redirect(dashboardUrl)
  }

  if (pathname !== '/auth/mfa' && mfaRequired && !pathname.startsWith('/api')) {
    return NextResponse.redirect(mfaUrl)
  }

  if (isPublicPath(pathname) && pathname !== '/auth/mfa') {
    return NextResponse.redirect(mfaRequired ? mfaUrl : dashboardUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
