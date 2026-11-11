import { useRef, useState } from 'react'

import { equipmentOptions, movementTypeOptions, muscleGroupOptions } from '../data/exercises'
import type { PersonalExercise } from '../types'
import type { PersonalExerciseInput } from '../services/supabaseFitnessStore'

type PersonalExerciseEditorProps = {
  exercise?: PersonalExercise
  onClose: () => void
  onSave: (input: PersonalExerciseInput) => Promise<void>
}

export function PersonalExerciseEditor({ exercise, onClose, onSave }: PersonalExerciseEditorProps) {
  const [name, setName] = useState(exercise?.name ?? '')
  const [description, setDescription] = useState(exercise?.description ?? '')
  const [primaryMuscleGroups, setPrimaryMuscleGroups] = useState(exercise?.primaryMuscleGroups ?? [])
  const [secondaryMuscles, setSecondaryMuscles] = useState(exercise?.secondaryMuscles ?? [])
  const [equipment, setEquipment] = useState(exercise?.type ?? '')
  const [movementType, setMovementType] = useState(exercise?.movementType ?? '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveLocked = useRef(false)

  const toggleValue = (values: string[], value: string, update: (next: string[]) => void) => {
    update(values.includes(value) ? values.filter((current) => current !== value) : [...values, value])
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saveLocked.current) return
    saveLocked.current = true
    setSaving(true)
    setErrorMessage(null)
    try {
      await onSave({
        ...(exercise ? { id: exercise.id } : {}),
        name,
        description,
        primaryMuscleGroups,
        secondaryMuscles,
        equipment: equipment || null,
        movementType: movementType || null,
      })
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'De oefening kon niet worden opgeslagen.')
    } finally {
      saveLocked.current = false
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="personal-exercise-title"
        className="mx-auto my-3 w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-soft sm:my-6 sm:p-6"
      >
        <h2 id="personal-exercise-title" className="text-2xl font-semibold text-white">
          {exercise ? 'Oefening bewerken' : 'Oefening toevoegen'}
        </h2>
        <form className="mt-5 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm font-medium text-slate-200">
            Naam <span className="text-rose-300">*</span>
            <input
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Beschrijving en uitvoering
            <textarea
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-500"
            />
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-slate-200">Primaire spiergroepen <span className="text-rose-300">*</span></legend>
            <div className="mt-2 grid max-h-44 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-800 p-3 sm:grid-cols-3">
              {muscleGroupOptions.map((muscle) => (
                <label key={muscle} className="flex items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={primaryMuscleGroups.includes(muscle)}
                    onChange={() => toggleValue(primaryMuscleGroups, muscle, setPrimaryMuscleGroups)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  {muscle}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-slate-200">Secundaire spiergroepen</legend>
            <div className="mt-2 grid max-h-44 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-800 p-3 sm:grid-cols-3">
              {muscleGroupOptions.map((muscle) => (
                <label key={muscle} className="flex items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={secondaryMuscles.includes(muscle)}
                    onChange={() => toggleValue(secondaryMuscles, muscle, setSecondaryMuscles)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  {muscle}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-200">
              Materiaal <span className="text-slate-500">(optioneel)</span>
              <select value={equipment} onChange={(event) => setEquipment(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-white">
                <option value="">Niet opgegeven</option>
                {equipmentOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Bewegingstype <span className="text-slate-500">(optioneel)</span>
              <select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-white">
                <option value="">Niet opgegeven</option>
                {movementTypeOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          {errorMessage ? <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</p> : null}

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500">Annuleren</button>
            <button type="submit" disabled={saving} className="min-h-11 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60">
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}