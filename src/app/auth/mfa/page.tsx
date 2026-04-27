'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'

type TotpEnrollment = {
  factorId: string
  qrCode: string
  secret?: string
}

export default function MfaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)

  const mode = useMemo(
    () => (enrollment ? 'enroll' : factorId ? 'verify' : 'loading'),
    [enrollment, factorId]
  )

  useEffect(() => {
    async function initialize() {
      setLoading(true)
      setError(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/auth/login')
        return
      }

      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) {
        setError('No pudimos consultar tus factores MFA.')
        setLoading(false)
        return
      }

      const verifiedTotp = factorsData?.totp?.[0]
      if (verifiedTotp) {
        setFactorId(verifiedTotp.id)
        setLoading(false)
        return
      }

      const allTotpFactors = (factorsData?.all ?? []).filter((f) => f.factor_type === 'totp')
      const unverified = allTotpFactors.find((f) => f.status === 'unverified')

      if (unverified) {
        setFactorId(unverified.id)
        setLoading(false)
        return
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Google Authenticator',
      })

      if (enrollError || !enrollData) {
        setError('No pudimos generar el segundo factor.')
        setLoading(false)
        return
      }

      setFactorId(enrollData.id)
      setEnrollment({
        factorId: enrollData.id,
        qrCode: enrollData.totp.qr_code,
        secret: enrollData.totp.secret,
      })
      setLoading(false)
    }

    void initialize()
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!factorId || code.trim().length < 6) return

    setSubmitting(true)
    setError(null)

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    })

    if (error) {
      setError('Código inválido o expirado. Probá de nuevo.')
      setSubmitting(false)
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/auth/login')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div className="w-full rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-lg">
        <h1 className="text-xl font-bold text-white">Verificación en dos pasos</h1>
        <p className="mt-2 text-sm text-gray-300">
          {mode === 'enroll'
            ? 'Escaneá el QR con Google Authenticator y cargá el código de 6 dígitos.'
            : 'Ingresá el código de Google Authenticator para completar el acceso.'}
        </p>

        {loading && <p className="mt-4 text-sm text-gray-400">Preparando verificación...</p>}

        {!loading && enrollment && (
          <div className="mt-4 rounded-md border border-surface-700 bg-surface-950 p-3">
            <Image
              src={enrollment.qrCode}
              alt="QR MFA"
              width={176}
              height={176}
              unoptimized
              className="mx-auto h-44 w-44 bg-white p-2"
            />
            {enrollment.secret && (
              <p className="mt-3 break-all text-xs text-gray-400">
                Clave manual: <span className="font-mono text-gray-300">{enrollment.secret}</span>
              </p>
            )}
          </div>
        )}

        {!loading && factorId && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <label className="block text-sm text-gray-300" htmlFor="totp-code">
              Código TOTP
            </label>
            <input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-white outline-none ring-brand-400 focus:ring-2"
              placeholder="123456"
            />
            <button
              type="submit"
              disabled={submitting || code.length < 6}
              className="w-full rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Verificando...' : 'Verificar y entrar'}
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="mt-4 w-full rounded-lg border border-surface-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-surface-800"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
