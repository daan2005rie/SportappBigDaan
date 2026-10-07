import { Search, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ProgressChart } from '../components/ProgressChart'
import { exerciseCatalog } from '../data/exercises'
import { loadExerciseProgress } from '../services/supabaseFitnessStore'

export function ProgressPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState(exerciseCatalog[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const selectedExercise = exerciseCatalog.find((exercise) => exercise.id === selectedExerciseId) ?? exerciseCatalog[0]
  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return []
    return exerciseCatalog
      .filter((exercise) => exercise.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8)
  }, [query])

  const [progressResult, setProgressResult] = useState<{
    exerciseId: string
    data: Awaited<ReturnType<typeof loadExerciseProgress>>
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!selectedExercise) return
    let active = true
    void loadExerciseProgress(selectedExercise.id)
      .then((data) => {
        if (active) setProgressResult({ exerciseId: selectedExercise.id, data, error: null })
      })
      .catch(() => {
        if (active) setProgressResult({ exerciseId: selectedExercise.id, data: [], error: 'Je progressie kon niet worden geladen.' })
      })
    return () => { active = false }
  }, [selectedExercise])

  const currentProgress = progressResult?.exerciseId === selectedExercise?.id ? progressResult : null
  const chartData = currentProgress?.data ?? []
  const loadingProgress = Boolean(selectedExercise && !currentProgress)
  const progressError = currentProgress?.error ?? null

  const latestWeight = chartData.at(-1)?.weight ?? 0
  const previousWeight = chartData.at(-2)?.weight ?? latestWeight
  const changeValue = previousWeight > 0 ? ((latestWeight - previousWeight) / previousWeight) * 100 : 0

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Progressie</p>
            <h3 className="mt-2 text-3xl font-semibold text-white">Oefening volgen</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300">
            <TrendingUp className="h-4 w-4" />
            {chartData.length > 1 ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}%` : 'Nieuw'}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
        <div>
          <label className="relative block">
            <span className="mb-2 block text-sm text-slate-300">Zoek oefening</span>
            <Search className="pointer-events-none absolute left-3 top-[2.65rem] h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek op oefeningsnaam…"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 py-2.5 pl-10 pr-3 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              aria-label="Zoek oefening op naam"
              aria-autocomplete="list"
              aria-controls="progress-exercise-results"
            />
          </label>

          {query.trim() ? (
            <ul id="progress-exercise-results" className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-2">
              {filteredExercises.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExerciseId(exercise.id)
                      setQuery('')
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-800 ${
                      exercise.id === selectedExerciseId ? 'text-emerald-300' : 'text-slate-200'
                    }`}
                  >
                    <span className="font-medium">{exercise.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{exercise.muscleGroup}</span>
                  </button>
                </li>
              ))}
              {filteredExercises.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400">Geen oefeningen gevonden.</li>
              ) : null}
            </ul>
          ) : null}

          {selectedExercise ? (
            <p className="mt-3 text-sm text-slate-400">
              Geselecteerd: <span className="font-medium text-white">{selectedExercise.name}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Huidig max</p>
            <p className="mt-3 text-2xl font-semibold text-white">{latestWeight} kg</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Laatste wijziging</p>
            <p className="mt-3 text-2xl font-semibold text-emerald-300">
              {chartData.length > 1 ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Meetpunten</p>
            <p className="mt-3 text-2xl font-semibold text-white">{chartData.length}</p>
          </div>
        </div>

        <div className="mt-6">
          {progressError ? <p role="alert" className="mb-3 text-sm text-rose-200">{progressError}</p> : null}
          {loadingProgress ? <p role="status" className="mb-3 text-sm text-slate-400">Progressie laden…</p> : null}
          <ProgressChart data={chartData} />
        </div>
      </section>
    </div>
  )
}
