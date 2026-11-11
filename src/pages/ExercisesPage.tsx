import { BookOpen, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PersonalExerciseEditor } from '../components/PersonalExerciseEditor'
import { exerciseCatalog } from '../data/exercises'
import type { Exercise, PersonalExercise } from '../types'
import { filterExercises } from '../services/exerciseLibrary'
import { loadPersonalExercises, savePersonalExercise } from '../services/supabaseFitnessStore'

export function ExercisesPage() {
  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([])
  const [query, setQuery] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void loadPersonalExercises()
      .then((exercises) => { if (active) setPersonalExercises(exercises) })
      .catch(() => { if (active) setErrorMessage('Je eigen oefeningen konden niet worden geladen.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filteredStandard = useMemo(() => filterExercises(exerciseCatalog, query), [query])
  const filteredPersonal = useMemo(() => filterExercises(personalExercises, query), [personalExercises, query])
  const renderExercise = (exercise: Exercise, personal: boolean) => (
    <li key={`${personal ? 'personal' : 'standard'}-${exercise.id}`}>
      <Link
        to={`/exercises/${encodeURIComponent(exercise.id)}`}
        className="block h-full rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-emerald-500/50 hover:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-white">{exercise.name}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${personal ? 'bg-cyan-400/10 text-cyan-200' : 'bg-emerald-400/10 text-emerald-200'}`}>
            {personal ? 'Eigen' : 'Standaard'}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-400">{(exercise.primaryMuscleGroups ?? [exercise.muscleGroup]).join(', ')}</p>
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{exercise.description || 'Geen beschrijving opgegeven.'}</p>
      </Link>
    </li>
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Bibliotheek</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Oefeningen</h1>
        </div>
        <button type="button" onClick={() => setEditorOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
          <Plus className="h-4 w-4" />
          Oefening toevoegen
        </button>
      </section>

      <label className="relative block">
        <span className="sr-only">Zoek oefeningen op naam</span>
        <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek oefeningen op naam…" className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pl-11 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-emerald-500" />
      </label>

      {errorMessage ? <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</p> : null}
      {loading ? <p role="status" className="text-sm text-slate-400">Oefeningen laden…</p> : null}

      <section aria-labelledby="standard-exercises-title">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-300" />
          <h2 id="standard-exercises-title" className="text-lg font-semibold text-white">Standaardoefeningen</h2>
          <span className="text-sm text-slate-500">{filteredStandard.length}</span>
        </div>
        {filteredStandard.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredStandard.map((exercise) => renderExercise(exercise, false))}</ul>
        ) : <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">Geen standaardoefeningen gevonden.</p>}
      </section>

      <section aria-labelledby="personal-exercises-title">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="personal-exercises-title" className="text-lg font-semibold text-white">Mijn oefeningen</h2>
          <span className="text-sm text-slate-500">{filteredPersonal.length}</span>
        </div>
        {filteredPersonal.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredPersonal.map((exercise) => renderExercise(exercise, true))}</ul>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
            <BookOpen className="h-5 w-5 shrink-0" />
            {query ? 'Geen eigen oefeningen gevonden.' : 'Je hebt nog geen eigen oefeningen.'}
          </div>
        )}
      </section>

      {editorOpen ? (
        <PersonalExerciseEditor
          onClose={() => setEditorOpen(false)}
          onSave={async (input) => {
            const savedExercise = await savePersonalExercise(input)
            setPersonalExercises((current) => [...current, savedExercise].sort((first, second) => first.name.localeCompare(second.name)))
          }}
        />
      ) : null}
    </div>
  )
}