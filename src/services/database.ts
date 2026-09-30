import { createClient } from '@supabase/supabase-js'

export const databaseConfig = {
  provider: 'Supabase + Postgres',
  persistence: 'local-first during phase 1, cloud-ready by design',
  authenticationReady: true,
  syncReady: true,
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://example.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'demo-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'x-app-name': 'bigdaan',
    },
  },
})

export const getDatabaseProviderLabel = () => databaseConfig.provider
