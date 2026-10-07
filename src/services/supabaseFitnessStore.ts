import { exerciseCatalog } from '../data/exercises'
import type {
  CompletedWorkout,
  CompletedWorkoutExercise,
  CompletedWorkoutSet,
  PersonalRecord,
  PresetExercise,
  WorkoutDraft,
  WorkoutExerciseItem,
  WorkoutPreset,
} from '../types'
import type { WorkoutPreset as WorkoutPresetType } from '../types'
import { supabase } from './database'
import { getDashboardMetrics, getExerciseProgressForExercise, getTopExercisesByVolume, getWeeklyVolumeTrend } from './workoutStore'

export const MAX_WORKOUT_PRESETS = 10

type WorkoutRow = {
  id: string
  user_id: string
  name: string
  started_at: string
  completed_at: string
  preset_id: string | null
  created_at: string
}

type WorkoutExerciseRow = {
  id: string
  workout_id: string
  user_id: string
  exercise_id: string
  exercise_order: number
}

type WorkoutSetRow = {
  id: string
  workout_exercise_id: string
  user_id: string
  set_number: number
  weight_kg: number
  reps: number
}

type PresetRow = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

type PresetExerciseRow = {
  preset_id: string
  exercise_id: string
  exercise_order: number
  default_sets: number
}

type WorkoutDraftRow = {
  id: string
  name: string
  started_at: string
  preset_id: string | null
  draft_data: WorkoutDraft
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser()
  throwIfError(error)
  if (!data.user) throw new Error('Je sessie is verlopen. Log opnieuw in.')
  return data.user.id
}

function mapPreset(row: PresetRow, exercises: PresetExerciseRow[]): WorkoutPreset {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exercises: exercises
      .filter((exercise) => exercise.preset_id === row.id)
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map((exercise) => ({
        exerciseId: exercise.exercise_id,
        order: exercise.exercise_order,
        defaultSets: exercise.default_sets,
      })),
  }
}

function mapWorkoutRows(
  workoutRows: WorkoutRow[],
  exerciseRows: WorkoutExerciseRow[],
  setRows: WorkoutSetRow[],
): CompletedWorkout[] {
  const catalogById = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]))
  return workoutRows.map((workout) => {
    const exercises: CompletedWorkoutExercise[] = exerciseRows
      .filter((exercise) => exercise.workout_id === workout.id)
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map((exercise) => {
        const catalogExercise = catalogById.get(exercise.exercise_id)
        const sets: CompletedWorkoutSet[] = setRows
          .filter((set) => set.workout_exercise_id === exercise.id)
          .sort((a, b) => a.set_number - b.set_number)
          .map((set) => ({
            id: set.id,
            setNumber: set.set_number,
            weight: Number(set.weight_kg),
            reps: set.reps,
          }))
        return {
          id: exercise.id,
          exerciseId: exercise.exercise_id,
          name: catalogExercise?.name ?? `Onbekende oefening (${exercise.exercise_id})`,
          muscleGroup: catalogExercise?.muscleGroup ?? '',
          secondaryMuscleGroup: catalogExercise?.secondaryMuscleGroup,
          type: catalogExercise?.type ?? '',
          order: exercise.exercise_order,
          sets,
        }
      })
    return {
      id: workout.id,
      ...(workout.preset_id ? { presetId: workout.preset_id } : {}),
      name: workout.name,
      startedAt: workout.started_at,
      completedAt: workout.completed_at,
      createdAt: workout.created_at,
      exercises,
    }
  })
}

export async function loadCompletedWorkouts(): Promise<CompletedWorkout[]> {
  const userId = await requireUserId()
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id,user_id,name,started_at,completed_at,preset_id,created_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
  throwIfError(error)
  const workoutRows = (workouts ?? []) as WorkoutRow[]
  if (!workoutRows.length) return []

  const workoutIds = workoutRows.map((workout) => workout.id)
  const { data: exercises, error: exerciseError } = await supabase
    .from('workout_exercises')
    .select('id,workout_id,user_id,exercise_id,exercise_order')
    .eq('user_id', userId)
    .in('workout_id', workoutIds)
  throwIfError(exerciseError)
  const exerciseRows = (exercises ?? []) as WorkoutExerciseRow[]
  if (!exerciseRows.length) return mapWorkoutRows(workoutRows, [], [])

  const { data: sets, error: setError } = await supabase
    .from('workout_sets')
    .select('id,workout_exercise_id,user_id,set_number,weight_kg,reps')
    .eq('user_id', userId)
    .in('workout_exercise_id', exerciseRows.map((exercise) => exercise.id))
  throwIfError(setError)
  return mapWorkoutRows(workoutRows, exerciseRows, (sets ?? []) as WorkoutSetRow[])
}

export async function findWorkoutById(id: string) {
  return (await loadCompletedWorkouts()).find((workout) => workout.id === id) ?? null
}

export async function loadWorkoutPresets(): Promise<WorkoutPreset[]> {
  const userId = await requireUserId()
  const { data: presets, error } = await supabase
    .from('workout_presets')
    .select('id,user_id,name,created_at,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  throwIfError(error)
  const presetRows = (presets ?? []) as PresetRow[]
  if (!presetRows.length) return []
  const { data: exercises, error: exerciseError } = await supabase
    .from('preset_exercises')
    .select('preset_id,exercise_id,exercise_order,default_sets')
    .eq('user_id', userId)
    .in('preset_id', presetRows.map((preset) => preset.id))
  throwIfError(exerciseError)
  const exerciseRows = (exercises ?? []) as PresetExerciseRow[]
  return presetRows.map((preset) => mapPreset(preset, exerciseRows))
}

export async function saveWorkoutPreset(input: { id?: string; name: string; exercises: PresetExercise[] }) {
  const { data, error } = await supabase.rpc('persist_workout_preset', {
    p_preset_id: input.id ?? null,
    p_name: input.name,
    p_exercises: input.exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      order: index + 1,
      defaultSets: exercise.defaultSets,
    })),
  })
  throwIfError(error)
  const presets = await loadWorkoutPresets()
  const saved = presets.find((preset) => preset.id === data)
  if (!saved) throw new Error('De preset is opgeslagen maar kon niet opnieuw worden geladen.')
  return saved
}

export async function deleteWorkoutPreset(presetId: string) {
  const { data, error } = await supabase.rpc('delete_workout_preset', { p_preset_id: presetId })
  throwIfError(error)
  if (!data) throw new Error('Deze preset bestaat niet meer of is niet beschikbaar.')
}

export async function loadWorkoutSessionDraft(): Promise<WorkoutDraft | null> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('workout_drafts')
    .select('id,name,started_at,preset_id,draft_data')
    .eq('user_id', userId)
    .maybeSingle()
  throwIfError(error)
  if (!data) return null
  const row = data as WorkoutDraftRow
  const draftData = { ...row.draft_data }
  if (row.preset_id) draftData.presetId = row.preset_id
  else delete draftData.presetId
  return {
    ...draftData,
    id: row.id,
    name: row.name,
    startedAt: row.started_at,
  }
}

export async function saveWorkoutSessionDraft(draft: WorkoutDraft) {
  const { error } = await supabase.rpc('persist_workout_draft', { p_draft: draft })
  throwIfError(error)
}

export async function clearWorkoutDraft() {
  const userId = await requireUserId()
  const { error } = await supabase.from('workout_drafts').delete().eq('user_id', userId)
  throwIfError(error)
}

export function validateWorkout(exercises: WorkoutExerciseItem[]) {
  if (!exercises.length) return 'Voeg minimaal één oefening toe aan de workout.'
  for (const exercise of exercises) {
    if (!exercise.sets.length) return `Voeg ten minste één set toe voor ${exercise.name}.`
    for (const set of exercise.sets) {
      if (!set.weight.trim()) return `Vul het gewicht in bij ${exercise.name}.`
      const weight = Number(set.weight)
      const reps = Number(set.reps)
      if (!Number.isFinite(weight) || weight < 0) return `Controleer het gewicht bij ${exercise.name}.`
      if (!set.reps.trim() || !Number.isInteger(reps) || reps <= 0) return `Controleer het aantal herhalingen bij ${exercise.name}.`
    }
  }
  return null
}

function detectNewRecords(workout: CompletedWorkout, previousWorkouts: CompletedWorkout[]): PersonalRecord[] {
  const records: PersonalRecord[] = []
  for (const exercise of workout.exercises) {
    const bestSet = exercise.sets.reduce<CompletedWorkoutSet | undefined>((best, set) => (
      !best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best
    ), undefined)
    if (!bestSet || bestSet.weight <= 0) continue
    const previousBest = previousWorkouts
      .flatMap((previousWorkout) => previousWorkout.exercises)
      .filter((previousExercise) => previousExercise.exerciseId === exercise.exerciseId)
      .flatMap((previousExercise) => previousExercise.sets)
      .reduce((best, set) => Math.max(best, set.weight), 0)
    if (bestSet.weight <= previousBest) continue
    records.push({
      id: crypto.randomUUID(),
      userId: '',
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      weight: bestSet.weight,
      reps: bestSet.reps,
      workoutId: workout.id,
      achievedAt: workout.completedAt,
    })
  }
  return records
}

export async function saveCompletedWorkout(workout: CompletedWorkout) {
  const previousWorkouts = await loadCompletedWorkouts()
  const payload = {
    ...workout,
    exercises: workout.exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      order: index + 1,
      sets: exercise.sets.map((set, setIndex) => ({
        setNumber: setIndex + 1,
        weight: set.weight,
        reps: set.reps,
      })),
    })),
  }
  const { error } = await supabase.rpc('persist_workout', { p_workout: payload })
  throwIfError(error)
  return { newRecords: detectNewRecords(workout, previousWorkouts) }
}

export async function getExercisePerformance(exerciseId: string) {
  const workouts = await loadCompletedWorkouts()
  const previousExercise = workouts
    .map((workout) => ({ workout, exercise: workout.exercises.find((item) => item.exerciseId === exerciseId) }))
    .find((entry) => entry.exercise?.sets.length)
  const previousSet = previousExercise?.exercise?.sets.reduce((best, set) => (
    set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best
  ))
  const personalRecord = workouts
    .flatMap((workout) => workout.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .flatMap((exercise) => exercise.sets.map((set) => ({ set, workout }))))
    .sort((a, b) => b.set.weight - a.set.weight || b.set.reps - a.set.reps)[0]
  return {
    previousPerformance: previousSet ? `Vorige keer: ${previousSet.weight} kg × ${previousSet.reps}` : undefined,
    personalRecord: personalRecord ? `PR: ${personalRecord.set.weight} kg × ${personalRecord.set.reps}` : undefined,
  }
}

export async function createWorkoutExercisesFromPreset(preset: WorkoutPresetType) {
  const workouts = await loadCompletedWorkouts()
  const catalogById = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]))
  let missingExerciseCount = 0
  const exercises = preset.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((presetExercise) => {
      const exercise = catalogById.get(String(presetExercise.exerciseId))
      if (!exercise) {
        missingExerciseCount += 1
        return []
      }

      const previousExercise = workouts
        .map((workout) => workout.exercises.find((entry) => entry.exerciseId === exercise.id))
        .find((entry) => entry?.sets.length)
      const previousSet = previousExercise?.sets.reduce((best, set) => (
        set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best
      ))
      const personalRecord = workouts
        .flatMap((workout) => workout.exercises
          .filter((entry) => entry.exerciseId === exercise.id)
          .flatMap((entry) => entry.sets))
        .sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0]

      return [{
        id: `${exercise.id}-${crypto.randomUUID()}`,
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        secondaryMuscleGroup: exercise.secondaryMuscleGroup,
        type: exercise.type,
        previousPerformance: previousSet ? `Vorige keer: ${previousSet.weight} kg × ${previousSet.reps}` : undefined,
        personalRecord: personalRecord ? `PR: ${personalRecord.weight} kg × ${personalRecord.reps}` : undefined,
        sets: Array.from({ length: Math.min(10, Math.max(1, presetExercise.defaultSets)) }, () => ({
          id: `set-${crypto.randomUUID()}`,
          weight: '',
          reps: '',
        })),
      }]
    })

  return { exercises, missingExerciseCount }
}

export async function loadPersonalRecords(): Promise<PersonalRecord[]> {
  const workouts = await loadCompletedWorkouts()
  const bestByExercise = new Map<string, PersonalRecord>()
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const bestSet = exercise.sets.reduce<CompletedWorkoutSet | undefined>((best, set) => (
        !best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best
      ), undefined)
      if (!bestSet || bestSet.weight <= 0) continue
      const current = bestByExercise.get(exercise.exerciseId)
      if (!current || bestSet.weight > current.weight || (bestSet.weight === current.weight && bestSet.reps > current.reps)) {
        bestByExercise.set(exercise.exerciseId, {
          id: `${workout.id}:${exercise.exerciseId}`,
          userId: '',
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          weight: bestSet.weight,
          reps: bestSet.reps,
          workoutId: workout.id,
          achievedAt: workout.completedAt,
        })
      }
    }
  }
  return [...bestByExercise.values()].sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
}

export async function getAnalytics() {
  const workouts = await loadCompletedWorkouts()
  const records = await loadPersonalRecords()
  return {
    workouts,
    records,
    metrics: getDashboardMetrics(workouts),
    volumeTrend: getWeeklyVolumeTrend(workouts),
    topExercises: getTopExercisesByVolume(workouts),
    getExerciseProgress: (exerciseId: string) => getExerciseProgressForExercise(exerciseId, workouts),
  }
}

export async function loadExerciseProgress(exerciseId: string) {
  const workouts = await loadCompletedWorkouts()
  return getExerciseProgressForExercise(exerciseId, workouts)
}
