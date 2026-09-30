import { Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { exerciseCatalog } from '../data/exercises'
import type { Exercise, WorkoutExerciseItem, WorkoutSetEntry } from '../types'
import {
  clearWorkoutDraft,
  loadWorkoutDraft,
  saveCompletedWorkout,
  saveWorkoutDraft,
  toCompletedWorkout,
  validateWorkout,
} from '../services/workoutStore'

const previousHistory: Record<string, { previous: string; personalRecord: string }> = {
  'bench-press': { previous: 'Vorige keer: 75 kg × 8', personalRecord: 'PR: 80 kg × 8' },
  squat: { previous: 'Vorige keer: 90 kg × 5', personalRecord: 'PR: 100 kg × 5' },
  'lat-pulldown': { previous: 'Vorige keer: 65 kg × 10', personalRecord: 'PR: 70 kg × 10' },
  deadlift: { previous: 'Vorige keer: 120 kg × 5', personalRecord: 'PR: 135 kg × 5' },
}

const createSet = (weight = '', reps = ''): WorkoutSetEntry => ({
  id: `set-${crypto.randomUUID()}`,
  weight,
  reps,
})

export function WorkoutPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('Borst & Triceps')
  const [startedAt] = useState(new Date().toISOString())
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExerciseItem[]>(() => loadWorkoutDraft() || [
    {
      id: 'bench-press-workout',
      exerciseId: 'bench-press',
      name: 'Bench Press',
      muscleGroup: 'Chest',
      secondaryMuscleGroup: 'Triceps',
      type: 'Barbell',
      previousPerformance: previousHistory['bench-press']?.previous,
      personalRecord: previousHistory['bench-press']?.personalRecord,
      sets: [
        { id: 'set-1', weight: '60', reps: '10' },
        { id: 'set-2', weight: '70', reps: '8' },
        { id: 'set-3', weight: '75', reps: '6' },
      ],
    },
  ])

  useEffect(() => {
    saveWorkoutDraft(selectedExercises)
  }, [selectedExercises])

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return exerciseCatalog.slice(0, 8)
    }

    return exerciseCatalog.filter((exercise) => {
      const haystack = `${exercise.name} ${exercise.muscleGroup} ${exercise.secondaryMuscleGroup ?? ''} ${exercise.type}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [query])

  const addExercise = (exercise: Exercise) => {
    setSelectedExercises((current) => {
      if (current.some((item) => item.exerciseId === exercise.id)) {
        return current
      }

      const history = previousHistory[exercise.id]

      return [
        ...current,
        {
          id: `${exercise.id}-${crypto.randomUUID()}`,
          exerciseId: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          secondaryMuscleGroup: exercise.secondaryMuscleGroup,
          type: exercise.type,
          previousPerformance: history?.previous,
          personalRecord: history?.personalRecord,
          sets: [createSet('60', '8')],
        },
      ]
    })
  }

  const removeExercise = (exerciseId: string) => {
    setSelectedExercises((current) => current.filter((exercise) => exercise.id !== exerciseId))
  }

  const updateSetValue = (exerciseId: string, setId: string, field: 'weight' | 'reps', value: string) => {
    setSelectedExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId
                  ? {
                      ...set,
                      [field]: value,
                    }
                  : set,
              ),
            }
          : exercise,
      ),
    )
  }

  const addSet = (exerciseId: string) => {
    setSelectedExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets, createSet('', '')],
            }
          : exercise,
      ),
    )
  }

  const removeSet = (exerciseId: string, setId: string) => {
    setSelectedExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise
        }

        const nextSets = exercise.sets.filter((set) => set.id !== setId)

        return {
          ...exercise,
          sets: nextSets.length > 0 ? nextSets : [createSet('', '')],
        }
      }),
    )
  }

  const handleCompleteWorkout = () => {
    const validationError = validateWorkout(selectedExercises)

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    const completedWorkout = toCompletedWorkout(draftName.trim() || 'Workout', selectedExercises, startedAt)
    const { newRecords } = saveCompletedWorkout(completedWorkout)
    clearWorkoutDraft()
    setSelectedExercises([])
    setErrorMessage(null)
    navigate(`/workouts/${completedWorkout.id}`, { state: { newRecords } })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workout builder</p>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-3xl font-semibold text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
              aria-label="Naam van de workout"
            />
          </div>

          <button
            type="button"
            onClick={handleCompleteWorkout}
            className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30"
          >
            Workout voltooien
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
          <label className="relative block">
            <span className="sr-only">Zoeken</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek oefening…"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </label>

          <ul className="mt-4 space-y-3">
            {filteredExercises.map((exercise) => {
              const isSelected = selectedExercises.some((entry) => entry.exerciseId === exercise.id)

              return (
                <li key={exercise.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <div>
                    <p className="font-medium text-white">{exercise.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                      {exercise.muscleGroup} • {exercise.type}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addExercise(exercise)}
                    disabled={isSelected}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
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
          </ul>
        </section>

        <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
          {selectedExercises.length === 0 ? (
            <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-slate-300">
              <div>
                <p className="text-lg font-medium text-white">Nog geen oefeningen toegevoegd</p>
                <p className="mt-2 text-sm text-slate-400">Zoek een oefening en voeg deze toe aan je workout.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {selectedExercises.map((exercise) => (
                <div key={exercise.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Oefening</p>
                      <h4 className="mt-1 text-xl font-semibold text-white">{exercise.name}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExercise(exercise.id)}
                      className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:border-rose-500 hover:text-rose-300"
                      aria-label={`Verwijder ${exercise.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-800 px-2 py-1">{exercise.muscleGroup}</span>
                    {exercise.secondaryMuscleGroup ? (
                      <span className="rounded-full bg-slate-800 px-2 py-1">{exercise.secondaryMuscleGroup}</span>
                    ) : null}
                    <span className="rounded-full bg-slate-800 px-2 py-1">{exercise.type}</span>
                  </div>

                  {exercise.previousPerformance || exercise.personalRecord ? (
                    <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3 text-sm text-slate-200">
                      {exercise.previousPerformance ? <p>{exercise.previousPerformance}</p> : null}
                      {exercise.personalRecord ? <p className="mt-1 text-emerald-300">{exercise.personalRecord}</p> : null}
                    </div>
                  ) : null}

                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
                    <div className="grid grid-cols-[1fr_1.3fr_1.3fr_0.8fr] bg-slate-950/80 px-4 py-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                      <span>Set</span>
                      <span>Gewicht</span>
                      <span>Herhalingen</span>
                      <span />
                    </div>

                    {exercise.sets.map((set, index) => (
                      <div
                        key={set.id}
                        className="grid grid-cols-[1fr_1.3fr_1.3fr_0.8fr] items-center border-t border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-200"
                      >
                        <span>{index + 1}</span>
                        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-1.5">
                          <input
                            aria-label={`Gewicht set ${index + 1} voor ${exercise.name}`}
                            type="number"
                            min="0"
                            step="0.5"
                            value={set.weight}
                            onChange={(event) => updateSetValue(exercise.id, set.id, 'weight', event.target.value)}
                            className="w-full bg-transparent text-white outline-none"
                          />
                          <span className="text-slate-400">kg</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-1.5">
                          <input
                            aria-label={`Herhalingen set ${index + 1} voor ${exercise.name}`}
                            type="number"
                            min="1"
                            step="1"
                            value={set.reps}
                            onChange={(event) => updateSetValue(exercise.id, set.id, 'reps', event.target.value)}
                            className="w-full bg-transparent text-white outline-none"
                          />
                          <span className="text-slate-400">reps</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSet(exercise.id, set.id)}
                          className="justify-self-end rounded-full border border-slate-700 p-2 text-slate-400 transition hover:border-rose-500 hover:text-rose-300"
                          aria-label={`Verwijder set ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addSet(exercise.id)}
                    className="mt-5 rounded-full border border-dashed border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-500 hover:text-emerald-300"
                  >
                    + Set toevoegen
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
