'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    // If user lands on login with invite or recovery token in hash, forward to update-password
    if (typeof window === 'undefined' || !window.location.hash) return
    const hash = window.location.hash
    const params = new URLSearchParams(hash.substring(1))
    if (params.has('access_token') && (params.get('type') === 'invite' || params.get('type') === 'recovery')) {
      window.location.replace('/update-password' + hash)
    }
  }, [])

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const requestedNext = new URLSearchParams(window.location.search).get('next')
    if (requestedNext?.startsWith('/') && !requestedNext.startsWith('//')) {
      formData.set('next', requestedNext)
    }
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setPending(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-slate-100 bg-cover bg-center bg-no-repeat p-4 sm:p-6"
      style={{ backgroundImage: "url('/paylix-login-background.svg')" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(rgba(15,23,42,0.18),rgba(15,23,42,0.28))]" />

      <div className="relative w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-md sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <Link href="/">
            <img
              src="/Paylix_login.png"
              alt="Paylix"
              className="h-12 w-auto max-w-full object-contain sm:h-14 md:h-16"
            />
          </Link>
          <p className="mt-3 text-sm text-slate-600">
            Connectez-vous pour gérer votre établissement
          </p>
        </div>

        <form action={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Adresse email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="nom@paylix.com"
                className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                disabled={pending}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Mot de passe
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 pr-12 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                  disabled={pending}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:pointer-events-none disabled:opacity-50"
                  disabled={pending}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_10px_25px_rgba(16,185,129,0.3)] transition-all hover:from-emerald-500 hover:to-emerald-700 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connexion en cours...
              </>
            ) : (
              'Se connecter'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
