import { CalendarDays } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { CompletedWorkout } from '../types'
import { formatWorkoutDate, getWorkoutStats, loadCompletedWorkouts } from '../services/workoutStore'

export function WorkoutHistoryPage() {
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([])

  useEffect(() => {
    setWorkouts(loadCompletedWorkouts())
  }, [])

  if (workouts.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 text-center shadow-soft">
        <p className="text-xl font-semibold text-white">Nog geen workouts</p>
        <p className="mt-2 text-sm text-slate-400">Start je eerste workout om je progressie hier te zien.</p>
        <Link to="/workout" className="mt-5 inline-flex rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
          Workout starten
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mijn workouts</p>
        <h3 className="mt-2 text-3xl font-semibold text-white">Workout geschiedenis</h3>
      </section>

      <div className="space-y-4">
        {workouts.map((workout) => {
          const stats = getWorkoutStats(workout)

          return (
            <Link
              key={workout.id}
              to={`/workouts/${workout.id}`}
              className="block w-full rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 text-left shadow-soft transition hover:border-slate-700 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm text-slate-400">
                    <CalendarDays className="h-4 w-4 text-emerald-300" />
                    {formatWorkoutDate(workout.completedAt)}
                  </p>
                  <h4 className="mt-3 text-2xl font-semibold text-white">{workout.name}</h4>
                </div>
                <span className="inline-flex h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500" />
              </div>

              <p className="mt-3 text-sm text-slate-300">
                {stats.totalExercises} oefeningen • {stats.totalSets} sets
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
