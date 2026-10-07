import { ArrowDown, ArrowUp, Minus, Plus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { exerciseCatalog } from '../data/exercises'
import type { PresetExercise, WorkoutPreset } from '../types'
import { ExerciseSelector } from './ExerciseSelector'

type WorkoutPresetEditorProps = {
  preset?: WorkoutPreset
  onClose: () => void
  onSave: (input: { id?: string; name: string; exercises: PresetExercise[] }) => Promise<string | null> | string | null
}

export function WorkoutPresetEditor({ preset, onClose, onSave }: WorkoutPresetEditorProps) {
  const [name, setName] = useState(preset?.name ?? '')
  const [exercises, setExercises] = useState<PresetExercise[]>(() => preset?.exercises.map((exercise) => ({ ...exercise })) ?? [])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveLocked = useRef(false)
  const exerciseById = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]))

  const addExercise = (exerciseId: string) => {
    setExercises((current) => [
      ...current,
      { exerciseId, order: current.length + 1, defaultSets: 3 },
    ])
    setErrorMessage(null)
  }

  const removeExercise = (exerciseId: string) => {
    setExercises((current) => current
      .filter((exercise) => exercise.exerciseId !== exerciseId)
      .map((exercise, index) => ({ ...exercise, order: index + 1 })))
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    setExercises((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const next = current.slice()
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next.map((exercise, exerciseIndex) => ({ ...exercise, order: exerciseIndex + 1 }))
    })
  }

  const changeSets = (exerciseId: string, delta: -1 | 1) => {
    setExercises((current) => current.map((exercise) => exercise.exerciseId === exerciseId
      ? { ...exercise, defaultSets: Math.min(10, Math.max(1, exercise.defaultSets + delta)) }
      : exercise))
  }

  const handleSave = async () => {
    if (saveLocked.current) return
    saveLocked.current = true
    setSaving(true)
    const error = await onSave({ id: preset?.id, name, exercises })
    if (error) {
      setErrorMessage(error)
      saveLocked.current = false
      setSaving(false)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-editor-title"
        className="mx-auto my-3 max-w-6xl rounded-[28px] border border-slate-700 bg-slate-900 p-4 shadow-soft sm:my-6 sm:p-6"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workout presets</p>
            <h2 id="preset-editor-title" className="mt-1 text-2xl font-semibold text-white">
              {preset ? 'Preset bewerken' : 'Nieuwe preset'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
            aria-label="Editor sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <label className="mt-5 block max-w-xl text-sm font-medium text-slate-200">
          Naam van de preset
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="Bijvoorbeeld Push Day"
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
          />
        </label>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Oefeningen toevoegen</h3>
            <ExerciseSelector
              selectedExerciseIds={exercises.map((exercise) => exercise.exerciseId)}
              onAdd={(exercise) => addExercise(exercise.id)}
              muscleGroupFilter
            />
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Volgorde en sets</h3>
              <span className="text-xs text-slate-400">{exercises.length} oefeningen</span>
            </div>
            {exercises.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center rounded-[28px] border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">
                Voeg oefeningen toe om je preset samen te stellen.
              </div>
            ) : (
              <ol className="space-y-3">
                {exercises.map((exercise, index) => {
                  const name = exerciseById.get(exercise.exerciseId)?.name ?? `Oefening niet gevonden (${exercise.exerciseId})`
                  return (
                    <li key={exercise.exerciseId} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="mr-2 text-xs text-slate-500">{index + 1}.</span>
                          <span className="font-medium text-white">{name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveExercise(index, -1)}
                            disabled={index === 0}
                            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 disabled:opacity-35"
                            aria-label={`Verplaats ${name} omhoog`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveExercise(index, 1)}
                            disabled={index === exercises.length - 1}
                            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 disabled:opacity-35"
                            aria-label={`Verplaats ${name} omlaag`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExercise(exercise.exerciseId)}
                            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-rose-500 hover:text-rose-300"
                            aria-label={`Verwijder ${name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                        <span>Standaard sets</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => changeSets(exercise.exerciseId, -1)}
                            disabled={exercise.defaultSets <= 1}
                            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 disabled:opacity-35"
                            aria-label={`Minder sets voor ${name}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-5 text-center font-semibold text-white">{exercise.defaultSets}</span>
                          <button
                            type="button"
                            onClick={() => changeSets(exercise.exerciseId, 1)}
                            disabled={exercise.defaultSets >= 10}
                            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 disabled:opacity-35"
                            aria-label={`Meer sets voor ${name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>

        {errorMessage ? (
          <p role="alert" className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Opslaan…' : 'Wijzigingen opslaan'}
          </button>
        </footer>
      </section>
    </div>
  )
}
