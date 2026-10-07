import { ArrowUpRight, Dumbbell, LogOut, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { navigationItems } from '../data/dashboard'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const location = useLocation()
  const { currentUser, migrationError, signOut } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)
  const currentPage = navigationItems.find((item) => item.href === location.pathname) ?? navigationItems[0]

  const handleSignOut = async () => {
    setAuthError(null)
    const result = await signOut()
    if (result.error) setAuthError(result.error)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
          <aside className="hidden lg:block">
            <div className="sticky top-5 rounded-[30px] border border-slate-800 bg-slate-900/80 p-4 shadow-soft">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/30">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">Athlete</p>
                  <h1 className="text-lg font-semibold text-white">BigDaan</h1>
                </div>
              </div>

              <nav className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href

                  return (
                    <NavLink
                      key={item.key}
                      to={item.href}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  )
                })}
              </nav>

              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">Focus</span>
                </div>
                <p className="mt-2 text-sm text-slate-200">Volg je progressie en bouw sterker op.</p>
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <header className="flex items-center justify-between rounded-[28px] border border-slate-800 bg-slate-900/80 px-5 py-4 shadow-soft backdrop-blur-sm">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Overview</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{currentPage.label}</h2>
              </div>

              <div className="flex items-center gap-2">
                {location.pathname === '/' ? (
                  <Link
                    to="/workout"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110"
                  >
                    Workout starten
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
                  aria-label={`Uitloggen${currentUser?.email ? ` (${currentUser.email})` : ''}`}
                  title={currentUser?.email ?? 'Uitloggen'}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Uitloggen</span>
                </button>
              </div>
            </header>

            {authError ? <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{authError}</p> : null}
            {migrationError ? <p role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{migrationError}</p> : null}
            <Outlet />
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
