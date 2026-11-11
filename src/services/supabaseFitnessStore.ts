import { equipmentOptions, exerciseCatalog, movementTypeOptions, muscleGroupOptions } from '../data/exercises'
import type {
  CompletedWorkout,
  CompletedWorkoutExercise,
  CompletedWorkoutSet,
  Exercise,
  PersonalExercise,
  PersonalRecord,
  PresetExercise,
  WorkoutDraft,
  WorkoutExerciseItem,
  WorkoutPreset,
} from '../types'
import type { WorkoutPreset as WorkoutPresetType } from '../types'
import { supabase } from './database'
import { getDashboardMetrics, getExerciseProgressForExercise, getTopExerciseSets, getTopExercisesByVolume, getWeeklyVolumeTrend } from './workoutStore'

import { assertCompletedWorkoutOrder } from './workoutOrder'

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
  exercise_name: string | null
  primary_muscles: string[] | null
  secondary_muscles: string[] | null
  description: string | null
  equipment: string | null
  movement_type: string | null
}

type PersonalExerciseRow = {
  id: string
  user_id: string
  name: string
  description: string
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string | null
  movement_type: string | null
  archived_at: string | null
}

export type PersonalExerciseInput = {
  id?: string
  name: string
  description: string
  primaryMuscleGroups: string[]
  secondaryMuscles: string[]
  equipment: string | null
  movementType: string | null
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

function mapPersonalExercise(row: PersonalExerciseRow): PersonalExercise {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    primaryMuscleGroups: row.primary_muscles,
    muscleGroup: row.primary_muscles[0] ?? '',
    secondaryMuscles: row.secondary_muscles,
    secondaryMuscleGroup: row.secondary_muscles[0],
    type: row.equipment ?? '',
    movementType: row.movement_type ?? undefined,
    archivedAt: row.archived_at,
  }
}

export function validatePersonalExercise(input: PersonalExerciseInput) {
  if (!input.name.trim() || input.name.trim().length > 80) return 'Vul een naam van maximaal 80 tekens in.'
  if (input.description.length > 2000) return 'De beschrijving mag maximaal 2000 tekens bevatten.'
  if (!input.primaryMuscleGroups.length) return 'Kies minimaal één primaire spiergroep.'

  const validMuscleGroups = new Set(muscleGroupOptions)
  const allSelectedMuscles = [...input.primaryMuscleGroups, ...input.secondaryMuscles]
  if (allSelectedMuscles.some((muscle) => !validMuscleGroups.has(muscle))) return 'Kies spiergroepen uit de bestaande lijst.'
  if (new Set(input.primaryMuscleGroups).size !== input.primaryMuscleGroups.length
    || new Set(input.secondaryMuscles).size !== input.secondaryMuscles.length) {
    return 'Een spiergroep kan niet dubbel worden gekozen.'
  }
  if (input.primaryMuscleGroups.some((muscle) => input.secondaryMuscles.includes(muscle))) {
    return 'Een spiergroep kan niet tegelijk primair en secundair zijn.'
  }
  if (input.equipment && !equipmentOptions.includes(input.equipment)) return 'Kies materiaal uit de bestaande lijst.'
  if (input.movementType && !movementTypeOptions.includes(input.movementType)) return 'Kies een bewegingstype uit de bestaande lijst.'
  return null
}

const PERSONAL_EXERCISE_COLUMNS = 'id,user_id,name,description,primary_muscles,secondary_muscles,equipment,movement_type,archived_at'

export async function loadPersonalExercises(includeArchived = false): Promise<PersonalExercise[]> {
  const userId = await requireUserId()
  let query = supabase
    .from('personal_exercises')
    .select(PERSONAL_EXERCISE_COLUMNS)
    .eq('user_id', userId)
  if (!includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query.order('name', { ascending: true })
  throwIfError(error)
  return ((data ?? []) as PersonalExerciseRow[]).map(mapPersonalExercise)
}

export async function loadExerciseById(exerciseId: string): Promise<Exercise | null> {
  const standardExercise = exerciseCatalog.find((exercise) => exercise.id === exerciseId)
  if (standardExercise) return standardExercise

  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('personal_exercises')
    .select(PERSONAL_EXERCISE_COLUMNS)
    .eq('id', exerciseId)
    .eq('user_id', userId)
    .maybeSingle()
  throwIfError(error)
  return data ? mapPersonalExercise(data as PersonalExerciseRow) : null
}

export async function savePersonalExercise(input: PersonalExerciseInput): Promise<PersonalExercise> {
  const validationError = validatePersonalExercise(input)
  if (validationError) throw new Error(validationError)
  const userId = await requireUserId()
  const payload = {
    name: input.name.trim(),
    description: input.description.trim(),
    primary_muscles: input.primaryMuscleGroups,
    secondary_muscles: input.secondaryMuscles,
    equipment: input.equipment,
    movement_type: input.movementType,
  }
  const query = input.id
    ? supabase.from('personal_exercises').update(payload).eq('id', input.id).eq('user_id', userId)
    : supabase.from('personal_exercises').insert({ ...payload, user_id: userId })
  const { data, error } = await query.select(PERSONAL_EXERCISE_COLUMNS).maybeSingle()
  throwIfError(error)
  if (!data) throw new Error('De oefening bestaat niet meer of is niet beschikbaar.')
  return mapPersonalExercise(data as PersonalExerciseRow)
}

export async function archivePersonalExercise(exerciseId: string) {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('personal_exercises')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', exerciseId)
    .eq('user_id', userId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle()
  throwIfError(error)
  if (!data) throw new Error('De oefening bestaat niet meer of is al gearchiveerd.')
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
        // An older RPC wrote two empty arrays even when the old client sent no
        // metadata at all. Treat only that recognizable standard-exercise shape
        // as absent; named snapshots and intentional empty secondary lists stay.
        const legacyMissingMuscles = Boolean(catalogExercise)
          && exercise.exercise_name == null && exercise.description == null
          && exercise.equipment == null && exercise.movement_type == null
          && exercise.primary_muscles?.length === 0 && exercise.secondary_muscles?.length === 0
        const primaryMuscles = exercise.primary_muscles != null && !legacyMissingMuscles
          ? exercise.primary_muscles
          : catalogExercise?.primaryMuscleGroups ?? (catalogExercise ? [catalogExercise.muscleGroup] : [])
        const secondaryMuscles = exercise.secondary_muscles != null && !legacyMissingMuscles
          ? exercise.secondary_muscles
          : catalogExercise?.secondaryMuscles ?? []
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
          name: exercise.exercise_name ?? catalogExercise?.name ?? `Onbekende oefening (${exercise.exercise_id})`,
          muscleGroup: primaryMuscles[0] ?? '',
          primaryMuscles,
          secondaryMuscleGroup: secondaryMuscles[0],
          secondaryMuscles,
          type: exercise.equipment ?? catalogExercise?.type ?? '',
          movementType: exercise.movement_type ?? catalogExercise?.movementType,
          description: exercise.description ?? catalogExercise?.description,
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
    .select('id,workout_id,user_id,exercise_id,exercise_order,exercise_name,primary_muscles,secondary_muscles,description,equipment,movement_type')
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
  assertCompletedWorkoutOrder(workout, previousWorkouts)
  const payload = {
    ...workout,
    exercises: workout.exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      primaryMuscles: exercise.primaryMuscles ?? [exercise.muscleGroup],
      secondaryMuscles: exercise.secondaryMuscles ?? (exercise.secondaryMuscleGroup ? [exercise.secondaryMuscleGroup] : []),
      description: exercise.description ?? null,
      type: exercise.type,
      movementType: exercise.movementType ?? null,
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

export async function createWorkoutExercisesFromPreset(preset: WorkoutPresetType, personalExercises: PersonalExercise[] = []) {
  const workouts = await loadCompletedWorkouts()
  const exerciseById = new Map([...exerciseCatalog, ...personalExercises].map((exercise) => [exercise.id, exercise]))
  let missingExerciseCount = 0
  const exercises = preset.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((presetExercise) => {
      const exercise = exerciseById.get(String(presetExercise.exerciseId))
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
        primaryMuscles: exercise.primaryMuscleGroups ?? [exercise.muscleGroup],
        secondaryMuscleGroup: exercise.secondaryMuscleGroup,
        secondaryMuscles: exercise.secondaryMuscles ?? (exercise.secondaryMuscleGroup ? [exercise.secondaryMuscleGroup] : []),
        type: exercise.type,
        movementType: exercise.movementType,
        description: exercise.description,
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

export async function loadTopExerciseSets(exerciseId: string, limit = 5) {
  const workouts = await loadCompletedWorkouts()
  return getTopExerciseSets(exerciseId, workouts, limit)
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
