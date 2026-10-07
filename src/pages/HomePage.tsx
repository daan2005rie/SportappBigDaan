import { Activity, CalendarDays, Flame, Target, Trophy } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useEffect, useState } from 'react'

import { StatCard } from '../components/StatCard'
import { getAnalytics } from '../services/supabaseFitnessStore'

type DashboardData = Awaited<ReturnType<typeof getAnalytics>>

export function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getAnalytics()
      .then((analytics) => { if (active) setData(analytics) })
      .catch(() => { if (active) setErrorMessage('Je fitnessgegevens konden niet worden geladen.') })
    return () => { active = false }
  }, [])

  if (!data && !errorMessage) {
    return <div role="status" className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 text-center text-sm text-slate-300">Dashboard laden…</div>
  }

  if (!data) {
    return <div role="alert" className="rounded-[28px] border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">{errorMessage}</div>
  }

  const workouts = data.workouts
  const dashboardMetrics = data.metrics
  const latestWorkout = workouts[0] ?? null
  const latestStats = latestWorkout ? {
    totalExercises: latestWorkout.exercises.length,
    totalSets: latestWorkout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0),
  } : null
  const volumeTrend = data.volumeTrend.slice(-6)
  const topExercises = data.topExercises.slice(0, 3)

  const prRecords = data.records.slice(0, 3)
  const latestRecords = prRecords.length
    ? prRecords.map((record) => ({
        id: record.id,
        name: record.exerciseName,
        value: `${record.weight} kg × ${record.reps}`,
        detail: 'Nieuw PR',
      }))
    : [
        { id: 'placeholder', name: 'Nog geen PR', value: '—', detail: 'Train om een record te bouwen' },
      ]

  const metricCards = [
    {
      id: 'week-workouts',
      label: 'Workouts deze week',
      value: String(dashboardMetrics.workoutsThisWeek),
      change: dashboardMetrics.workoutsThisWeek > 0 ? 'Actief' : 'Rustig',
      trend: 'up' as const,
    },
    {
      id: 'avg-volume',
      label: 'Gemiddeld volume',
      value: `${dashboardMetrics.averageVolume} kg`,
      change: 'Per workout',
      trend: 'up' as const,
    },
    {
      id: 'consistency',
      label: 'Consistency',
      value: `${Math.round(dashboardMetrics.consistency)}%`,
      change: '30 dagen',
      trend: 'neutral' as const,
    },
  ]

  const quickStats = [
    {
      id: 'streak',
      label: 'Training streak',
      value: `${Math.min(7, workouts.length)} dagen`,
      icon: Flame,
    },
    {
      id: 'pr',
      label: 'PR vorige week',
      value: prRecords[0] ? `${prRecords[0].weight} kg × ${prRecords[0].reps}` : 'Nog geen',
      icon: Trophy,
    },
  ]

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        {metricCards.map((card) => (
          <StatCard key={card.id} card={card} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Laatste workout</p>
              <h3 className="mt-2 text-3xl font-semibold text-white">{latestWorkout?.name ?? 'Nog geen workout'}</h3>
            </div>
            <button type="button" className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500">
              Openen
            </button>
          </div>

          {latestWorkout ? (
            <>
              <div className="mt-5 flex items-center gap-2 text-slate-300">
                <CalendarDays className="h-4 w-4 text-emerald-300" />
                <span>{new Date(latestWorkout.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Oefeningen</p>
                  <p className="mt-2 text-2xl font-bold text-white">{latestStats?.totalExercises ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sets</p>
                  <p className="mt-2 text-2xl font-bold text-white">{latestStats?.totalSets ?? 0}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-5 text-sm text-slate-400">Start je eerste training om hier live data te zien.</p>
          )}
        </section>

        <aside className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
          <div className="flex items-center gap-2 text-emerald-300">
            <Target className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.2em]">Nieuwe records</p>
          </div>

          <ul className="mt-4 space-y-3">
            {latestRecords.map((record) => (
              <li key={record.id} className="rounded-2xl bg-slate-950/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{record.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{record.detail}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-xs font-medium text-emerald-300">
                    {record.value}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-2 text-cyan-300">
          <Activity className="h-4 w-4" />
          <p className="text-xs uppercase tracking-[0.2em]">Volume trend</p>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
              />
              <Bar dataKey="volume" fill="#22d3ee" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2 text-cyan-300">
            <Activity className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.2em]">Korte progressie</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {quickStats.map((stat) => {
              const Icon = stat.icon

              return (
                <div key={stat.id} className="flex items-center justify-between rounded-2xl bg-slate-950/70 p-4">
                  <div>
                    <p className="text-sm text-slate-400">{stat.label}</p>
                    <p className="mt-1 text-xl font-semibold text-white">{stat.value}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2 text-emerald-300">
            <Target className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.2em]">Top oefeningen</p>
          </div>

          <ul className="space-y-3">
            {topExercises.map((exercise, index) => (
              <li key={exercise.exerciseId} className="flex items-center justify-between rounded-2xl bg-slate-950/70 p-3">
                <div>
                  <p className="text-sm text-slate-400">#{index + 1}</p>
                  <p className="text-base font-semibold text-white">{exercise.name}</p>
                </div>
                <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-xs font-medium text-emerald-300">
                  {exercise.volume} kg
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
