import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuthError, Session } from '@supabase/supabase-js'

import { AuthContext } from './authContextCore'
import type { AuthContextValue } from './authContextCore'
import { isSupabaseConfigured, supabase } from '../services/database'
import { migrateLegacyFitnessData } from '../services/migrateLegacyFitnessData'

const authErrorMessage = (error: AuthError | Error | null) => {
  if (!error) return null
  if (error.message.toLowerCase().includes('invalid login credentials')) return 'E-mailadres of wachtwoord is onjuist.'
  if (error.message.toLowerCase().includes('user already registered')) return 'Er bestaat al een account met dit e-mailadres.'
  if (error.message.toLowerCase().includes('password')) return 'Gebruik een wachtwoord dat voldoet aan de Supabase-wachtwoordregels.'
  if (error.message.toLowerCase().includes('email')) return 'Controleer het e-mailadres en probeer het opnieuw.'
  return 'Er ging iets mis. Probeer het opnieuw.'
}

const configurationError = 'Supabase is nog niet ingesteld. Configureer de project-URL en publishable key.'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [migrationReadyUsers, setMigrationReadyUsers] = useState<Set<string>>(() => new Set())
  const [migrationIssue, setMigrationIssue] = useState<{ userId: string; message: string } | null>(null)
  const migrationAttempted = useRef(new Set<string>())
  const currentUserId = session?.user.id
  const migrationLoading = Boolean(currentUserId && isSupabaseConfigured && !migrationReadyUsers.has(currentUserId))
  const migrationError = migrationIssue && migrationIssue.userId === currentUserId ? migrationIssue.message : null

  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setLoading(false)
      }
    })

    if (isSupabaseConfigured) {
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return
        setSession(error ? null : data.session)
        setLoading(false)
      })
    }

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = currentUserId
    if (!userId || !isSupabaseConfigured || migrationAttempted.current.has(userId)) return
    migrationAttempted.current.add(userId)
    void migrateLegacyFitnessData(userId).catch((error: unknown) => {
      migrationAttempted.current.delete(userId)
      setMigrationIssue({
        userId,
        message: error instanceof Error ? error.message : 'Lokale workoutdata konden niet veilig worden gemigreerd.',
      })
    }).finally(() => {
      setMigrationReadyUsers((current) => new Set(current).add(userId))
    })
  }, [currentUserId])

  const value = useMemo<AuthContextValue>(() => ({
    currentUser: session?.user ?? null,
    session,
    loading,
    migrationLoading,
    migrationError,
    signUp: async (email, password, displayName) => {
      if (!isSupabaseConfigured) return { error: configurationError }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })
      return {
        error: authErrorMessage(error),
        needsEmailConfirmation: !error && !data.session,
      }
    },
    signIn: async (email, password) => {
      if (!isSupabaseConfigured) return { error: configurationError }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      return { error: authErrorMessage(error) }
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      return { error: authErrorMessage(error) }
    },
    sendPasswordReset: async (email) => {
      if (!isSupabaseConfigured) return { error: configurationError }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      return { error: authErrorMessage(error) }
    },
    updatePassword: async (password) => {
      if (!isSupabaseConfigured) return { error: configurationError }
      const { error } = await supabase.auth.updateUser({ password })
      return { error: authErrorMessage(error) }
    },
  }), [session, loading, migrationLoading, migrationError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
