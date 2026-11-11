import { Archive, ArrowLeft, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PersonalExerciseEditor } from '../components/PersonalExerciseEditor'
import { archivePersonalExercise, loadExerciseById, loadTopExerciseSets, savePersonalExercise } from '../services/supabaseFitnessStore'
import { getTopExerciseSets } from '../services/workoutStore'
import type { Exercise, PersonalExercise } from '../types'

export function ExerciseDetailsPage() {
  const { id = '' } = useParams()
  return <ExerciseDetails key={id} id={id} />
}

function ExerciseDetails({ id }: { id: string }) {
  const navigate = useNavigate()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [isPersonal, setIsPersonal] = useState(false)
  const [isArchived, setIsArchived] = useState(false)
  const [topSets, setTopSets] = useState<ReturnType<typeof getTopExerciseSets>>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const archiveLocked = useRef(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([loadExerciseById(id), loadTopExerciseSets(id)])
      .then(([loadedExercise, loadedTopSets]) => {
        if (!active) return
        setExercise(loadedExercise)
        setIsPersonal(Boolean(loadedExercise && 'userId' in loadedExercise))
        setIsArchived(Boolean(loadedExercise && 'archivedAt' in loadedExercise && loadedExercise.archivedAt))
        setTopSets(loadedTopSets)
      })
      .catch(() => { if (active) setErrorMessage('De oefening of je workoutgeschiedenis kon niet worden geladen.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  const handleArchive = async () => {
    if (!exercise || archiveLocked.current) return
    archiveLocked.current = true
    setArchiving(true)
    setActionError(null)
    try {
      await archivePersonalExercise(exercise.id)
      setIsArchived(true)
    } catch {
      setActionError('De oefening kon niet worden gearchiveerd. Probeer het opnieuw.')
    } finally {
      archiveLocked.current = false
      setArchiving(false)
    }
  }

  const personalExercise = isPersonal ? exercise as PersonalExercise : undefined
  const primaryMuscles = exercise?.primaryMuscleGroups ?? (exercise ? [exercise.muscleGroup] : [])

  if (loading) return <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">Oefening laden…</p>
  if (errorMessage) return <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">{errorMessage}</p>
  if (!exercise) return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h1 className="text-xl font-semibold text-white">Oefening niet gevonden</h1><Link to="/exercises" className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-300"><ArrowLeft className="h-4 w-4" />Terug naar oefeningen</Link></section>

  return (
    <div className="space-y-6">
      <Link to="/exercises" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Alle oefeningen</Link>

      {actionError ? <p role="alert" className="text-sm text-rose-200">{actionError}</p> : null}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${isPersonal ? 'bg-cyan-400/10 text-cyan-200' : 'bg-emerald-400/10 text-emerald-200'}`}>
              {isPersonal ? 'Eigen' : 'Standaard'}{isArchived ? ' · Gearchiveerd' : ''}
            </span>
            <h1 className="mt-3 break-words text-3xl font-semibold text-white">{exercise.name}</h1>
          </div>
          {personalExercise && !isArchived ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => setEditorOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"><Pencil className="h-4 w-4" />Bewerken</button>
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={archiving}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-500/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
              >
                <Archive className="h-4 w-4" />{archiving ? 'Archiveren…' : 'Archiveren'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Uitvoering</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-200">{exercise.description || 'Geen beschrijving opgegeven.'}</p>
            {exercise.type ? <p className="mt-4 text-sm text-slate-400">Materiaal: <span className="text-slate-200">{exercise.type}</span></p> : null}
            {exercise.movementType ? <p className="mt-1 text-sm text-slate-400">Bewegingstype: <span className="text-slate-200">{exercise.movementType}</span></p> : null}
          </div>
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Primaire spiergroepen</h2>
              <div className="mt-2 flex flex-wrap gap-2">{primaryMuscles.map((muscle) => <span key={muscle} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200">{muscle}</span>)}</div>
            </div>
            {exercise.secondaryMuscles?.length ? (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Secundaire spiergroepen</h2>
                <div className="mt-2 flex flex-wrap gap-2">{exercise.secondaryMuscles.map((muscle) => <span key={muscle} className="rounded-lg bg-slate-800/70 px-3 py-1.5 text-sm text-slate-300">{muscle}</span>)}</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-soft sm:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Voltooide workouts</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Mijn top 5 prestaties</h2>
          <p className="mt-1 text-sm text-slate-400">De vijf beste sets, gerangschikt op gewicht en daarna herhalingen.</p>
        </div>
        {topSets.length ? (
          <ol className="mt-5 divide-y divide-slate-800">
            {topSets.map((set, index) => (
              <li key={set.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3">
                <span className="text-sm font-semibold text-emerald-300">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{set.workoutName}</p>
                  <p className="text-xs text-slate-500">Set {set.setNumber} · {new Date(set.completedAt).toLocaleDateString('nl-NL')}</p>
                </div>
                <p className="whitespace-nowrap text-sm font-semibold text-slate-100">{set.weight} kg × {set.reps}</p>
              </li>
            ))}
          </ol>
        ) : <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">Nog geen voltooide sets voor deze oefening.</p>}
      </section>

      {personalExercise && editorOpen ? (
        <PersonalExerciseEditor
          exercise={personalExercise}
          onClose={() => setEditorOpen(false)}
          onSave={async (input) => {
            const updated = await savePersonalExercise(input)
            setExercise(updated)
          }}
        />
      ) : null}
      {isArchived ? <button type="button" onClick={() => navigate('/exercises')} className="text-sm text-emerald-300 hover:text-emerald-200">Terug naar oefeningen</button> : null}
    </div>
  )
}