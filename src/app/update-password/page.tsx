'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { confirmPasswordChange } from '@/app/actions/auth'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hashError, setHashError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isInvite, setIsInvite] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    async function initSession() {
      if (typeof window === 'undefined') return

      const hash = window.location.hash
      const search = window.location.search

      // Detect invite vs recovery flow
      if (hash.includes('type=invite') || search.includes('type=invite') ||
          hash.includes('type=magiclink') || search.includes('type=magiclink')) {
        setIsInvite(true)
      }

      // Handle error in hash (e.g. expired link)
      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
        const errorDesc = params.get('error_description')
        setHashError(
          errorDesc
            ? errorDesc.replace(/\+/g, ' ')
            : "Le lien d'activation est invalide ou expiré."
        )
        setCheckingSession(false)
        return
      }

      // Try to restore session from hash tokens (legacy / fallback flow)
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : '')
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          setHashError("Le lien d'activation est invalide ou expiré. Veuillez demander un nouveau lien.")
          setCheckingSession(false)
          return
        }
        setSessionReady(true)
        setCheckingSession(false)
        return
      }

      // Modern PKCE flow: session was already set server-side by /auth/callback.
      // Just check if there's an active session in the client.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
        setCheckingSession(false)
        return
      }

      // No session and no tokens → invalid link
      setHashError("Le lien d'activation est incomplet ou expiré. Veuillez utiliser le lien reçu par email.")
      setCheckingSession(false)
    }

    initSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!sessionReady) {
      setHashError("Impossible de valider la session. Veuillez réutiliser le lien d'invitation.")
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message || 'Impossible de mettre à jour le mot de passe.')
        setLoading(false)
        return
      }

      // Activate profile + membership via admin client (bypasses RLS)
      await confirmPasswordChange()

      setSuccess(true)
      // Small delay so the success message is visible before redirect
      setTimeout(() => {
        router.replace('/')
        router.refresh()
      }, 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.'
      setError(message)
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
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            {isInvite ? 'Activation de votre compte' : 'Définir un nouveau mot de passe'}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {isInvite
              ? 'Bienvenue sur Paylix ! Veuillez choisir votre mot de passe pour activer votre accès.'
              : 'Saisissez votre nouveau mot de passe pour sécuriser votre compte.'}
          </p>
        </div>

        {/* Vérification de la session en cours */}
        {checkingSession ? (
          <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm">Vérification du lien d&apos;activation...</p>
          </div>
        ) : hashError ? (
          <div className="space-y-4 rounded-xl border border-red-200 bg-red-50/80 p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Lien invalide ou expiré</h3>
            <p className="text-sm text-red-700">
              {hashError === 'Email link is invalid or has expired'
                ? "Le lien d'invitation que vous avez utilisé n'est plus valide. Veuillez demander une nouvelle invitation."
                : hashError}
            </p>
            <div className="pt-4">
              <Button
                onClick={() => (window.location.href = '/login')}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Retour à la connexion
              </Button>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 animate-bounce" />
            <h3 className="text-lg font-semibold text-emerald-900">
              Mot de passe enregistré avec succès !
            </h3>
            <p className="text-sm text-emerald-700">
              Redirection en cours vers votre espace de travail...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              {/* Nouveau mot de passe */}
              <div className="relative">
                <label
                  htmlFor="new-password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Input
                    id="new-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 pr-12 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              {/* Confirmer mot de passe */}
              <div className="relative">
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez votre mot de passe"
                    className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 pr-12 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement en cours...
                </span>
              ) : isInvite ? (
                'Activer mon compte'
              ) : (
                'Valider le mot de passe'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
