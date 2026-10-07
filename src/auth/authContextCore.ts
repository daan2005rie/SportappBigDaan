import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { ReactNode } from 'react'

type AuthActionResult = { error: string | null; needsEmailConfirmation?: boolean }

export type AuthContextValue = {
  currentUser: User | null
  session: Session | null
  loading: boolean
  migrationLoading: boolean
  migrationError: string | null
  signUp: (email: string, password: string, displayName: string) => Promise<AuthActionResult>
  signIn: (email: string, password: string) => Promise<AuthActionResult>
  signOut: () => Promise<AuthActionResult>
  sendPasswordReset: (email: string) => Promise<AuthActionResult>
  updatePassword: (password: string) => Promise<AuthActionResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
export type { AuthActionResult }
export type { ReactNode }
