import { Dumbbell } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { isSupabaseConfigured } from '../services/database'

type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password'

const fieldClassName = 'mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-500'

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { currentUser, loading, signIn, signUp, sendPasswordReset, updatePassword } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && currentUser && mode !== 'reset-password') return <Navigate to="/" replace />

  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot-password'
  const isReset = mode === 'reset-password'
  const title = isReset ? 'Nieuw wachtwoord' : isForgot ? 'Wachtwoord herstellen' : isRegister ? 'Account maken' : 'Welkom terug'
  const submitLabel = isReset ? 'Wachtwoord opslaan' : isForgot ? 'Herstellink versturen' : isRegister ? 'Account aanmaken' : 'Inloggen'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    if ((isRegister || isReset) && password.length < 8) {
      setErrorMessage('Gebruik minimaal 8 tekens voor je wachtwoord.')
      return
    }
    if ((isRegister || isReset) && password !== confirmPassword) {
      setErrorMessage('De wachtwoorden komen niet overeen.')
      return
    }

    setSubmitting(true)
    try {
      if (isRegister) {
        const result = await signUp(email, password, displayName)
        if (result.error) setErrorMessage(result.error)
        else if (result.needsEmailConfirmation) setStatusMessage('Controleer je e-mail om je account te bevestigen.')
        else navigate('/')
      } else if (isForgot) {
        const result = await sendPasswordReset(email)
        if (result.error) setErrorMessage(result.error)
        else setStatusMessage('Als er een account bij dit e-mailadres hoort, ontvang je een herstellink.')
      } else if (isReset) {
        const result = await updatePassword(password)
        if (result.error) setErrorMessage(result.error)
        else {
          setStatusMessage('Je wachtwoord is bijgewerkt. Je bent ingelogd.')
          navigate('/', { replace: true })
        }
      } else {
        const result = await signIn(email, password)
        if (result.error) setErrorMessage(result.error)
        else {
          const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
          navigate(from || '/', { replace: true })
        }
      }
    } catch {
      setErrorMessage('Er ging iets mis. Controleer je verbinding en probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <section className="w-full max-w-md rounded-[28px] border border-slate-800 bg-slate-900/90 p-6 shadow-soft sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">BigDaan</p>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <p role="alert" className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Supabase is nog niet ingesteld. Configureer de project-URL en publishable key.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister ? (
            <label className="block text-sm font-medium text-slate-200">
              Naam
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={80} className={fieldClassName} />
            </label>
          ) : null}

          {!isReset ? (
            <label className="block text-sm font-medium text-slate-200">
              E-mailadres
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className={fieldClassName}
              />
            </label>
          ) : null}

          {!isForgot ? (
            <label className="block text-sm font-medium text-slate-200">
              {isReset ? 'Nieuw wachtwoord' : 'Wachtwoord'}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isReset ? 'new-password' : isRegister ? 'new-password' : 'current-password'}
                minLength={8}
                required
                className={fieldClassName}
              />
            </label>
          ) : null}

          {isRegister || isReset ? (
            <label className="block text-sm font-medium text-slate-200">
              Herhaal wachtwoord
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className={fieldClassName}
              />
            </label>
          ) : null}

          {errorMessage ? <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</p> : null}
          {statusMessage ? <p role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{statusMessage}</p> : null}

          <button
            type="submit"
            disabled={submitting || !isSupabaseConfigured}
            className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Even geduld…' : submitLabel}
          </button>
        </form>

        <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          {mode === 'login' ? (
            <>
              <Link to="/register" className="text-emerald-300 hover:text-emerald-200">Account aanmaken</Link>
              <Link to="/forgot-password" className="hover:text-white">Wachtwoord vergeten?</Link>
            </>
          ) : null}
          {mode === 'register' ? <Link to="/login" className="text-emerald-300 hover:text-emerald-200">Ik heb al een account</Link> : null}
          {isForgot || isReset ? <Link to="/login" className="text-emerald-300 hover:text-emerald-200">Terug naar inloggen</Link> : null}
        </nav>
      </section>
    </main>
  )
}
