import { ArrowLeft, CalendarDays, Dumbbell, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import type { CompletedWorkout, PersonalRecord } from '../types'
import { formatWorkoutDate, getWorkoutStats } from '../services/workoutStore'
import { findWorkoutById, loadPersonalRecords } from '../services/supabaseFitnessStore'

export function WorkoutDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const [detailResult, setDetailResult] = useState<{
    workoutId: string
    workout: CompletedWorkout | null
    records: PersonalRecord[]
    error: boolean
  } | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    void Promise.all([findWorkoutById(id), loadPersonalRecords()])
      .then(([foundWorkout, records]) => {
        if (!active) return
        setDetailResult({
          workoutId: id,
          workout: foundWorkout,
          records: records.filter((record) => record.workoutId === id),
          error: false,
        })
      })
      .catch(() => {
        if (active) setDetailResult({ workoutId: id, workout: null, records: [], error: true })
      })
    return () => { active = false }
  }, [id])

  const currentDetail = detailResult?.workoutId === id ? detailResult : null
  const workout = currentDetail?.workout ?? null
  const savedRecords = currentDetail?.records ?? []
  const loading = Boolean(id && !currentDetail)
  const loadError = currentDetail?.error ?? false
  const locationRecords = (location.state as { newRecords?: Array<{ exerciseName: string; weight: number; reps: number }> } | null)?.newRecords ?? []
  const visibleNewRecords = locationRecords.length > 0 ? locationRecords : savedRecords

  if (loading) {
    return <div role="status" className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 text-center text-sm text-slate-300">Workout laden…</div>
  }

  if (loadError) {
    return <div role="alert" className="rounded-[28px] border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">Workoutgegevens konden niet worden geladen.</div>
  }

  if (!workout) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 text-center shadow-soft">
        <p className="text-lg font-semibold text-white">Workout niet gevonden</p>
        <p className="mt-2 text-sm text-slate-400">Deze training is niet beschikbaar in de geschiedenis.</p>
        <Link to="/workouts" className="mt-5 inline-flex rounded-full bg-emerald-500/12 px-4 py-2 text-sm font-medium text-emerald-300">
          Terug naar mijn workouts
        </Link>
      </div>
    )
  }

  const stats = getWorkoutStats(workout)

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workout details</p>
            <h3 className="mt-2 text-3xl font-semibold text-white">{workout.name}</h3>
          </div>

          <Link to="/workouts" className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-200">
            <ArrowLeft className="h-4 w-4" />
            Terug
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5">
            <CalendarDays className="h-4 w-4 text-emerald-300" />
            {formatWorkoutDate(workout.completedAt)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5">
            <Dumbbell className="h-4 w-4 text-cyan-300" />
            {stats.totalExercises} oefeningen
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5">
            <Trophy className="h-4 w-4 text-amber-300" />
            {stats.totalSets} sets
          </span>
        </div>
      </section>

      {visibleNewRecords.length > 0 ? (
        <section className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Nieuwe records</p>
          <div className="mt-4 space-y-3">
            {visibleNewRecords.map((record) => (
              <div key={record.exerciseName} className="rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-3 text-slate-100">
                <p className="font-medium text-white">{record.exerciseName}</p>
                <p className="mt-1 text-sm text-emerald-200">{record.weight} kg × {record.reps}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        {workout.exercises.map((exercise) => (
          <div key={exercise.id} className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Oefening</p>
                <h4 className="mt-1 text-2xl font-semibold text-white">{exercise.name}</h4>
              </div>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{exercise.type}</span>
            </div>

            <div className="mt-4 space-y-2">
              {exercise.sets.map((set) => (
                <div key={set.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                  <span className="text-slate-400">Set {set.setNumber}</span>
                  <div className="flex items-center gap-3">
                    <span>{set.weight} kg</span>
                    <span className="text-slate-500">×</span>
                    <span>{set.reps} reps</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
