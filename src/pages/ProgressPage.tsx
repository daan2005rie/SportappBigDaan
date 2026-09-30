import { TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'

import { exerciseOptions } from '../data/dashboard'
import { ProgressChart } from '../components/ProgressChart'
import { getExerciseProgressForExercise } from '../services/workoutStore'

export function ProgressPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState(exerciseOptions[0]?.id ?? '')
  const selectedExercise = exerciseOptions.find((exercise) => exercise.id === selectedExerciseId) ?? exerciseOptions[0]

  const chartData = useMemo(
    () => (selectedExercise ? getExerciseProgressForExercise(selectedExercise.id) : []),
    [selectedExercise],
  )

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
        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Selecteer oefening</span>
          <select
            value={selectedExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-white focus:border-emerald-500 focus:outline-none"
          >
            {exerciseOptions.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>

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
          <ProgressChart data={chartData} />
        </div>
      </section>
    </div>
  )
}
