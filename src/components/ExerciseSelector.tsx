import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { exerciseCatalog } from '../data/exercises'
import type { Exercise } from '../types'

type ExerciseSelectorProps = {
  selectedExerciseIds: string[]
  onAdd: (exercise: Exercise) => void
  muscleGroupFilter?: boolean
}

export function ExerciseSelector({
  selectedExerciseIds,
  onAdd,
  muscleGroupFilter = false,
}: ExerciseSelectorProps) {
  const [query, setQuery] = useState('')
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('')
  const muscleGroups = useMemo(
    () => [...new Set(exerciseCatalog.map((exercise) => exercise.muscleGroup))].sort((a, b) => a.localeCompare(b)),
    [],
  )
  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const matches = exerciseCatalog.filter((exercise) => (
      exercise.name.toLowerCase().includes(normalizedQuery)
      && (!selectedMuscleGroup || exercise.muscleGroup === selectedMuscleGroup)
    ))

    if (!normalizedQuery && !selectedMuscleGroup) return matches.slice(0, 8)
    return matches
  }, [query, selectedMuscleGroup])

  return (
    <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
      <label className="relative block">
        <span className="sr-only">Zoek oefening op naam</span>
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek oefening op naam…"
          className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
      </label>

      {muscleGroupFilter ? (
        <label className="mt-3 block">
          <span className="sr-only">Filter op spiergroep</span>
          <select
            value={selectedMuscleGroup}
            onChange={(event) => setSelectedMuscleGroup(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Alle spiergroepen</option>
            {muscleGroups.map((muscleGroup) => (
              <option key={muscleGroup} value={muscleGroup}>{muscleGroup}</option>
            ))}
          </select>
        </label>
      ) : null}

      <ul className="mt-4 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
        {filteredExercises.map((exercise) => {
          const isSelected = selectedExerciseIds.includes(exercise.id)

          return (
            <li key={exercise.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="min-w-0">
                <p className="font-medium text-white">{exercise.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {exercise.muscleGroup} • {exercise.type} • {exercise.movementType}
                </p>
                {exercise.secondaryMuscles?.length ? (
                  <p className="mt-1 text-xs text-slate-400">{exercise.secondaryMuscles.join(', ')}</p>
                ) : null}
                {exercise.description ? (
                  <p className="mt-1 text-xs text-slate-500">{exercise.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onAdd(exercise)}
                disabled={isSelected}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                    : 'bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20'
                }`}
              >
                {isSelected ? 'Toegevoegd' : 'Toevoegen'}
              </button>
            </li>
          )
        })}
        {filteredExercises.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Geen oefeningen gevonden.
          </li>
        ) : null}
      </ul>
    </section>
  )
}
