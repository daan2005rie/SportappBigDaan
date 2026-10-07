import { createClient } from '@supabase/supabase-js'

export const databaseConfig = {
  provider: 'Supabase + Postgres',
  persistence: 'Supabase Auth + Row Level Security',
  authenticationReady: true,
  syncReady: true,
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = createClient(
  supabaseUrl || 'https://missing-project.supabase.co',
  supabasePublishableKey || 'missing-publishable-key',
  {
  auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-app-name': 'bigdaan',
    },
  },
  },
)

export const getDatabaseProviderLabel = () => databaseConfig.provider
