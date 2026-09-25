'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, KeyRound, Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buildRecoveryRedirectUrl } from '@/lib/supabase/password-reset-url'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const redirectTo = buildRecoveryRedirectUrl(window.location.origin)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (resetError) {
        setError(resetError.message || 'Impossible d\'envoyer le lien de réinitialisation.')
        setLoading(false)
        return
      }

      setSubmitted(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-slate-100 bg-cover bg-center bg-no-repeat p-4 sm:p-6"
      style={{ backgroundImage: "url('/paylix-login-background.svg')" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(rgba(15,23,42,0.18),rgba(15,23,42,0.28))]" />

      <div className="relative w-full max-w-lg rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-md sm:p-8">
        <div className="mb-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-emerald-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </div>

        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
            <KeyRound className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Mot de passe oublié
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Entrez votre adresse email pour recevoir un lien de réinitialisation sécurisé.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h3 className="text-lg font-semibold text-emerald-900">
              Lien envoyé avec succès
            </h3>
            <p className="text-sm text-emerald-700">
              Si un compte correspond à <span className="font-semibold">{email}</span>, un email vous a été envoyé. Veuillez vérifier votre boîte de réception pour définir votre nouveau mot de passe.
            </p>
            <div className="pt-2">
              <Link href="/login">
                <Button variant="outline" className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                  Revenir à l'écran de connexion
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Adresse email
                </label>
                <div className="relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemple@ecole.test"
                    className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                    disabled={loading}
                  />
                  <Mail className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                disabled={loading}
              >
                {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
