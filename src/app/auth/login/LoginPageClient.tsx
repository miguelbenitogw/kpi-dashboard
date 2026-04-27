'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

function getErrorMessage(code: string | null) {
  if (!code) return null
  if (code === 'oauth') return 'No se pudo iniciar sesión con Google.'
  if (code === 'email_not_allowed') return 'Tu cuenta no está autorizada para este panel.'
  return 'Ocurrió un error de autenticación.'
}

export default function LoginPageClient() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const errorCode = searchParams.get('error')
  const next = searchParams.get('next') || '/dashboard'

  const error = useMemo(() => getErrorMessage(errorCode), [errorCode])

  async function handleGoogleLogin() {
    setLoading(true)

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      window.location.href = '/auth/login?error=oauth'
      return
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div className="w-full rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-lg">
        <h1 className="text-xl font-bold text-white">Acceso seguro</h1>
        <p className="mt-2 text-sm text-gray-300">
          Ingresá con Google y completá verificación en dos pasos para entrar al dashboard.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Redirigiendo...' : 'Continuar con Google'}
        </button>
      </div>
    </div>
  )
}
