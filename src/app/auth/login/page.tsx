import { Suspense } from 'react'
import LoginPageClient from './LoginPageClient'

function LoginFallback() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div className="w-full rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-lg">
        <h1 className="text-xl font-bold text-white">Acceso seguro</h1>
        <p className="mt-2 text-sm text-gray-300">Cargando...</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  )
}
