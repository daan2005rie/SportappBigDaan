import { Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { exerciseCatalog } from '../data/exercises'
import { ExerciseSelector } from '../components/ExerciseSelector'
import { WorkoutPresetEditor } from '../components/WorkoutPresetEditor'
import type { Exercise, PresetExercise, WorkoutDraft, WorkoutExerciseItem, WorkoutPreset, WorkoutSetEntry } from '../types'
import {
  clearWorkoutDraft,
  createWorkoutExercisesFromPreset,
  deleteWorkoutPreset,
  loadWorkoutPresets,
  saveWorkoutPreset,
  getExercisePerformance,
  loadWorkoutSessionDraft,
  saveCompletedWorkout,
  saveWorkoutSessionDraft,
  validateWorkout,
  MAX_WORKOUT_PRESETS,
} from '../services/supabaseFitnessStore'
import {
  toCompletedWorkout,
} from '../services/workoutStore'

const createSet = (weight = '', reps = ''): WorkoutSetEntry => ({
  id: `set-${crypto.randomUUID()}`,
  weight,
  reps,
})

export function WorkoutPage() {
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [presets, setPresets] = useState<WorkoutPreset[]>([])
  const [draft, setDraft] = useState<WorkoutDraft | null>(null)
  const [editingPreset, setEditingPreset] = useState<WorkoutPreset | null | undefined>(undefined)
  const [loadingData, setLoadingData] = useState(true)
  const [savingWorkout, setSavingWorkout] = useState(false)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishLocked = useRef(false)

  useEffect(() => {
    let active = true
    void Promise.all([loadWorkoutPresets(), loadWorkoutSessionDraft()])
      .then(([loadedPresets, loadedDraft]) => {
        if (!active) return
        setPresets(loadedPresets)
        setDraft(loadedDraft)
      })
      .catch(() => {
        if (active) setErrorMessage('Je workoutgegevens konden niet worden geladen. Controleer je verbinding en probeer opnieuw.')
      })
      .finally(() => {
        if (active) setLoadingData(false)
      })
    return () => {
      active = false
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (loadingData || !draft) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const snapshot = draft
    saveTimer.current = setTimeout(() => {
      saveQueue.current = saveQueue.current
        .then(() => saveWorkoutSessionDraft(snapshot))
        .catch(() => setErrorMessage('Je actieve workout kon niet worden opgeslagen. Controleer je verbinding.'))
    }, 400)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [draft, loadingData])

  const selectedExercises = draft?.exercises ?? []
  const exerciseById = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]))

  const updateExercises = (update: (current: WorkoutExerciseItem[]) => WorkoutExerciseItem[]) => {
    setDraft((current) => current ? { ...current, exercises: update(current.exercises) } : current)
  }

  const addExercise = (exercise: Exercise) => {
    void getExercisePerformance(exercise.id)
      .then((performance) => {
        const isPresetWorkout = Boolean(draft?.presetId)
        updateExercises((current) => current.some((item) => item.exerciseId === exercise.id)
          ? current
          : [...current, {
              id: `${exercise.id}-${crypto.randomUUID()}`,
              exerciseId: exercise.id,
              name: exercise.name,
              muscleGroup: exercise.muscleGroup,
              secondaryMuscleGroup: exercise.secondaryMuscleGroup,
              type: exercise.type,
              ...performance,
              sets: [createSet(isPresetWorkout ? '' : '60', isPresetWorkout ? '' : '8')],
            }])
      })
      .catch(() => setErrorMessage('De vorige prestaties konden niet worden geladen.'))
  }

  const removeExercise = (exerciseId: string) => {
    updateExercises((current) => current.filter((exercise) => exercise.id !== exerciseId))
  }

  const updateSetValue = (exerciseId: string, setId: string, field: 'weight' | 'reps', value: string) => {
    updateExercises((current) =>
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
    updateExercises((current) =>
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
    updateExercises((current) =>
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

  const startWorkout = async (preset?: WorkoutPreset) => {
    if (!preset) {
      setDraft({ id: crypto.randomUUID(), name: 'Workout', startedAt: new Date().toISOString(), exercises: [] })
      setErrorMessage(null)
      return
    }

    try {
    const result = await createWorkoutExercisesFromPreset(preset)
    if (!result.exercises.length) {
      setErrorMessage('Deze preset bevat geen beschikbare oefeningen. Bewerk de preset voordat je start.')
      return
    }

    setDraft({
      id: crypto.randomUUID(),
      name: preset.name,
      startedAt: new Date().toISOString(),
      presetId: preset.id,
      exercises: result.exercises,
    })
    setErrorMessage(result.missingExerciseCount
      ? `${result.missingExerciseCount} niet-beschikbare oefening(en) zijn overgeslagen.`
      : null)
    } catch {
      setErrorMessage('De preset kon niet worden gestart. Controleer je verbinding en probeer opnieuw.')
    }
  }

  const handleSavePreset = async (input: { id?: string; name: string; exercises: PresetExercise[] }) => {
    try {
      await saveWorkoutPreset(input)
      setPresets(await loadWorkoutPresets())
      setErrorMessage(null)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'De preset kon niet worden opgeslagen.'
    }
  }

  const handleDeletePreset = (preset: WorkoutPreset) => {
    const confirmed = window.confirm('Weet je zeker dat je deze preset wilt verwijderen? Je eerdere workouts blijven bewaard.')
    if (!confirmed) return
    void deleteWorkoutPreset(preset.id)
      .then(async () => {
        setPresets(await loadWorkoutPresets())
        setErrorMessage(null)
      })
      .catch(() => {
      setErrorMessage('De preset kon niet worden verwijderd. Probeer het opnieuw.')
      })
  }

  const handleCompleteWorkout = async () => {
    if (!draft || finishLocked.current || savingWorkout) return
    const validationError = validateWorkout(selectedExercises)

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    finishLocked.current = true
    setSavingWorkout(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      await saveQueue.current
      const completedWorkout = toCompletedWorkout(
        draft.name.trim() || 'Workout',
        selectedExercises,
        draft.startedAt,
        draft.presetId,
        draft.id,
      )
      const { newRecords } = await saveCompletedWorkout(completedWorkout)
      await clearWorkoutDraft()
      setDraft(null)
      setErrorMessage(null)
      navigate(`/workouts/${completedWorkout.id}`, { state: { newRecords } })
    } catch {
      let message = 'De workout kon niet worden afgerond.'
      try {
        await saveWorkoutSessionDraft(draft)
        message += ' Je actuele gegevens zijn als concept bewaard; probeer opnieuw.'
      } catch {
        message += ' De gegevens staan nog op deze pagina, maar de cloudkopie kon niet worden bevestigd. Laat deze pagina open en probeer opnieuw.'
      }
      setErrorMessage(message)
      finishLocked.current = false
    } finally {
      setSavingWorkout(false)
    }
  }

  return (
    <div className="space-y-6">
      {loadingData ? (
        <div role="status" className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 text-center text-sm text-slate-300">
          Workoutgegevens laden…
        </div>
      ) : null}
      {!loadingData && !draft ? (
        <>
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workout templates</p>
                <h3 className="mt-2 text-3xl font-semibold text-white">Mijn presets</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                disabled={presets.length >= MAX_WORKOUT_PRESETS}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Nieuwe preset
              </button>
            </div>

            {presets.length >= MAX_WORKOUT_PRESETS ? (
              <p className="mt-4 text-sm text-amber-300">Je hebt het maximum van 10 presets bereikt.</p>
            ) : null}
            {errorMessage ? (
              <p role="alert" className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {errorMessage}
              </p>
            ) : null}

            {presets.length === 0 ? (
              <div className="mt-5 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-white">Maak je eerste workout preset</h4>
                  <p className="mt-1 max-w-xl text-sm text-slate-400">
                    Sla je favoriete oefeningen op in een preset zodat je de volgende keer direct kunt beginnen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/40 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
                >
                  <Plus className="h-4 w-4" />
                  Maak preset
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {presets.map((preset) => (
                  <article key={preset.id} className="flex min-h-56 flex-col rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{preset.name}</h4>
                        <p className="mt-1 text-sm text-slate-400">{preset.exercises.length} oefeningen</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingPreset(preset)}
                          className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
                          aria-label={`Bewerk ${preset.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset)}
                          className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-rose-500 hover:text-rose-300"
                          aria-label={`Verwijder ${preset.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <ul className="mt-4 min-h-16 space-y-1 text-sm text-slate-300">
                      {preset.exercises.slice(0, 3).map((exercise) => (
                        <li key={exercise.exerciseId} className="truncate">
                          {exerciseById.get(exercise.exerciseId)?.name ?? 'Oefening niet beschikbaar'}
                        </li>
                      ))}
                      {preset.exercises.length > 3 ? (
                        <li className="text-xs text-slate-500">+ {preset.exercises.length - 3} meer</li>
                      ) : null}
                    </ul>
                    <button
                      type="button"
                      onClick={() => startWorkout(preset)}
                      className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                    >
                      <Play className="h-4 w-4" />
                      Start workout
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <button
            type="button"
            onClick={() => startWorkout()}
            className="w-full rounded-[28px] border border-slate-700 bg-slate-900/60 px-5 py-4 text-left text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Start zonder preset
          </button>
        </>
      ) : !loadingData && draft ? (
        <>
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workout builder</p>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-3xl font-semibold text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
                  aria-label="Naam van de workout"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCompleteWorkout()}
                disabled={savingWorkout}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30"
              >
                {savingWorkout ? 'Workout opslaan…' : 'Workout voltooien'}
              </button>
            </div>
            {errorMessage ? (
              <p role="alert" className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {errorMessage}
              </p>
            ) : null}
          </section>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <ExerciseSelector
              selectedExerciseIds={selectedExercises.map((exercise) => exercise.exerciseId)}
              onAdd={addExercise}
            />

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
                        <div className="grid grid-cols-[0.7fr_1.3fr_1.3fr_0.7fr] bg-slate-950/80 px-3 py-3 text-xs uppercase tracking-[0.12em] text-slate-400 sm:grid-cols-[1fr_1.3fr_1.3fr_0.8fr] sm:px-4 sm:tracking-[0.16em]">
                          <span>Set</span>
                          <span>Gewicht</span>
                          <span>Herhalingen</span>
                          <span />
                        </div>
                        {exercise.sets.map((set, index) => (
                          <div
                            key={set.id}
                            className="grid grid-cols-[0.7fr_1.3fr_1.3fr_0.7fr] items-center border-t border-slate-800 bg-slate-900/50 px-3 py-3 text-sm text-slate-200 sm:grid-cols-[1fr_1.3fr_1.3fr_0.8fr] sm:px-4"
                          >
                            <span>{index + 1}</span>
                            <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-1.5 sm:gap-2">
                              <input
                                aria-label={`Gewicht set ${index + 1} voor ${exercise.name}`}
                                type="number"
                                min="0"
                                step="0.5"
                                value={set.weight}
                                onChange={(event) => updateSetValue(exercise.id, set.id, 'weight', event.target.value)}
                                className="min-w-0 w-full bg-transparent text-white outline-none"
                              />
                              <span className="text-slate-400">kg</span>
                            </div>
                            <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-1.5 sm:gap-2">
                              <input
                                aria-label={`Herhalingen set ${index + 1} voor ${exercise.name}`}
                                type="number"
                                min="1"
                                step="1"
                                value={set.reps}
                                onChange={(event) => updateSetValue(exercise.id, set.id, 'reps', event.target.value)}
                                className="min-w-0 w-full bg-transparent text-white outline-none"
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
        </>
      ) : null}

      {editingPreset !== undefined ? (
        <WorkoutPresetEditor
          key={editingPreset?.id ?? 'new-preset'}
          preset={editingPreset ?? undefined}
          onClose={() => setEditingPreset(undefined)}
          onSave={handleSavePreset}
        />
      ) : null}
    </div>
  )
}
