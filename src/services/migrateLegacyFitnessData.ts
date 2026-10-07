import { exerciseCatalog } from '../data/exercises'
import type { CompletedWorkout, CompletedWorkoutExercise, WorkoutDraft } from '../types'
import {
  clearLegacyFitnessData,
  readLegacyFitnessData,
} from './workoutStore'
import {
  loadCompletedWorkouts,
  loadPersonalRecords,
  loadWorkoutPresets,
  loadWorkoutSessionDraft,
  saveCompletedWorkout,
  saveWorkoutPreset,
  saveWorkoutSessionDraft,
} from './supabaseFitnessStore'

const MIGRATION_MARKER_KEY = 'bigdaan.cloud-data-migration.v1'
const LEGACY_EXERCISE_NAMES: Record<string, string> = {
  'bench-press': 'Bench Press',
  'incline-bench-press': 'Incline Bench Press',
  squat: 'Squat',
  deadlift: 'Deadlift',
  'leg-press': 'Leg Press',
  'shoulder-press': 'Shoulder Press',
  'lat-pulldown': 'Lat Pulldown',
  'barbell-row': 'Barbell Row',
  'bicep-curl': 'Bicep Curl',
  'tricep-pushdown': 'Tricep Pushdown',
}

function normalizeExerciseKey(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resolveExercise(exerciseId: string, name?: string) {
  const byId = exerciseCatalog.find((exercise) => exercise.id === String(exerciseId))
  if (byId) return byId
  const normalizedId = normalizeExerciseKey(exerciseId)
  const legacyName = LEGACY_EXERCISE_NAMES[exerciseId.toLowerCase()]
  const normalizedName = normalizeExerciseKey(name ?? legacyName ?? exerciseId)
  return exerciseCatalog.find((exercise) => (
    normalizeExerciseKey(exercise.name) === normalizedName
    || normalizeExerciseKey(exercise.name) === normalizedId
  ))
}

async function stableUuid(userId: string, source: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${userId}:${source}`),
  ))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes.slice(0, 16)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function mapLegacyExercise(exercise: CompletedWorkoutExercise, order: number): CompletedWorkoutExercise {
  const catalogExercise = resolveExercise(exercise.exerciseId, exercise.name)
  if (!catalogExercise) throw new Error(`Oefening "${exercise.name}" kan niet aan de gedeelde catalogus worden gekoppeld.`)
  return {
    ...exercise,
    id: crypto.randomUUID(),
    exerciseId: catalogExercise.id,
    name: catalogExercise.name,
    muscleGroup: catalogExercise.muscleGroup,
    secondaryMuscleGroup: catalogExercise.secondaryMuscleGroup,
    type: catalogExercise.type,
    order,
    sets: exercise.sets.map((set, index) => ({
      ...set,
      id: crypto.randomUUID(),
      setNumber: index + 1,
      weight: Number(set.weight),
      reps: Number(set.reps),
    })),
  }
}

function mapLegacyDraftExercise(exercise: WorkoutDraft['exercises'][number]): WorkoutDraft['exercises'][number] {
  const catalogExercise = resolveExercise(exercise.exerciseId, exercise.name)
  if (!catalogExercise) throw new Error(`Oefening "${exercise.name}" kan niet aan de gedeelde catalogus worden gekoppeld.`)
  return {
    ...exercise,
    exerciseId: catalogExercise.id,
    name: catalogExercise.name,
    muscleGroup: catalogExercise.muscleGroup,
    secondaryMuscleGroup: catalogExercise.secondaryMuscleGroup,
    type: catalogExercise.type,
    sets: exercise.sets.map((set) => ({ ...set })),
  }
}

export async function migrateLegacyFitnessData(userId: string) {
  if (typeof window === 'undefined') return

  const legacy = readLegacyFitnessData()
  const legacyPresets = legacy.workoutPresets ?? []
  if (!legacy.workouts.length && !legacy.personalRecords.length && !legacy.draft && !legacyPresets.length) return

  const markerRaw = window.localStorage.getItem(MIGRATION_MARKER_KEY)
  if (markerRaw) {
    const marker = JSON.parse(markerRaw) as { userId?: string; complete?: boolean }
    if (marker.userId !== userId) {
      throw new Error('Er staat nog workoutdata van een ander lokaal account klaar. Die data is niet automatisch aan dit account gekoppeld.')
    }
    if (marker.complete) return
  }

  window.localStorage.setItem(MIGRATION_MARKER_KEY, JSON.stringify({ userId, complete: false }))
  const presetIdMap = new Map<string, string>()
  for (const preset of legacyPresets) {
    const presetId = await stableUuid(userId, `preset:${preset.id}`)
    const exercises = preset.exercises.map((exercise, index) => {
      const catalogExercise = resolveExercise(String(exercise.exerciseId))
      if (!catalogExercise) throw new Error(`Een oefening in preset "${preset.name}" kan niet aan de catalogus worden gekoppeld.`)
      return { exerciseId: catalogExercise.id, order: index + 1, defaultSets: exercise.defaultSets }
    })
    await saveWorkoutPreset({ id: presetId, name: preset.name, exercises })
    presetIdMap.set(preset.id, presetId)
  }

  const migratedWorkoutIds = new Map<string, string>()
  for (const workout of legacy.workouts) {
    const id = await stableUuid(userId, `workout:${workout.id}`)
    const startedAt = workout.startedAt || workout.completedAt
    const completedAt = workout.completedAt || workout.createdAt
    const mappedWorkout: CompletedWorkout = {
      id,
      name: workout.name,
      startedAt,
      completedAt,
      createdAt: workout.createdAt || completedAt,
      ...(workout.presetId && presetIdMap.has(workout.presetId) ? { presetId: presetIdMap.get(workout.presetId) } : {}),
      exercises: workout.exercises.map((exercise, index) => mapLegacyExercise(exercise, index + 1)),
    }
    if (!mappedWorkout.exercises.length) {
      throw new Error(`Workout "${workout.name}" bevat geen koppelbare oefeningen; lokale data is behouden.`)
    }
    await saveCompletedWorkout(mappedWorkout)
    migratedWorkoutIds.set(workout.id, id)
  }

  if (legacy.draft) {
    const draft: WorkoutDraft = {
      ...legacy.draft,
      id: await stableUuid(userId, `draft:${legacy.draft.id}`),
      ...(legacy.draft.presetId && presetIdMap.has(legacy.draft.presetId) ? { presetId: presetIdMap.get(legacy.draft.presetId) } : {}),
      exercises: legacy.draft.exercises.map(mapLegacyDraftExercise),
    }
    await saveWorkoutSessionDraft(draft)
  }

  const [cloudWorkouts, cloudPresets, cloudRecords] = await Promise.all([
    loadCompletedWorkouts(),
    loadWorkoutPresets(),
    loadPersonalRecords(),
  ])
  const cloudWorkoutIds = new Set(cloudWorkouts.map((workout) => workout.id))
  const cloudPresetIds = new Set(cloudPresets.map((preset) => preset.id))
  if ([...migratedWorkoutIds.values()].some((id) => !cloudWorkoutIds.has(id))) {
    throw new Error('Niet alle workouts zijn in Supabase teruggelezen; lokale data is behouden.')
  }
  if ([...presetIdMap.values()].some((id) => !cloudPresetIds.has(id))) {
    throw new Error('Niet alle presets zijn in Supabase teruggelezen; lokale data is behouden.')
  }
  if (legacy.draft && !(await loadWorkoutSessionDraft())) {
    throw new Error('Het actieve workoutconcept is niet in Supabase teruggelezen; lokale data is behouden.')
  }
  for (const record of legacy.personalRecords) {
    const exercise = resolveExercise(record.exerciseId, record.exerciseName)
    const expectedWorkoutId = migratedWorkoutIds.get(record.workoutId)
    const found = cloudRecords.some((cloudRecord) => (
      cloudRecord.exerciseId === exercise?.id
      && cloudRecord.workoutId === expectedWorkoutId
      && cloudRecord.weight >= record.weight
    ))
    if (!found) throw new Error('Een opgeslagen PR kan niet uit de gemigreerde workoutgeschiedenis worden hersteld; lokale data is behouden.')
  }

  clearLegacyFitnessData()
  window.localStorage.setItem(MIGRATION_MARKER_KEY, JSON.stringify({ userId, complete: true }))
}
