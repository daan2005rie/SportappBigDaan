import { exerciseCatalog } from '../data/exercises'
import type { PresetExercise, WorkoutExerciseItem, WorkoutPreset } from '../types'
import { getExercisePerformance } from './workoutStore'

const WORKOUT_PRESETS_KEY = 'bigdaan.workout-presets.v1'
export const MAX_WORKOUT_PRESETS = 10
const MIN_DEFAULT_SETS = 1
const MAX_DEFAULT_SETS = 10

export type WorkoutPresetInput = {
  id?: string
  name: string
  exercises: PresetExercise[]
}

export type WorkoutPresetSaveResult =
  | { success: true; preset: WorkoutPreset }
  | { success: false; error: string }

export function loadWorkoutPresets(): WorkoutPreset[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(WORKOUT_PRESETS_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((preset): preset is WorkoutPreset => (
      typeof preset?.id === 'string'
      && typeof preset?.userId === 'string'
      && typeof preset?.name === 'string'
      && Array.isArray(preset?.exercises)
      && typeof preset?.createdAt === 'string'
      && typeof preset?.updatedAt === 'string'
    ))
  } catch {
    return []
  }
}

export function validateWorkoutPreset(
  input: WorkoutPresetInput,
  existingPresets: WorkoutPreset[] = [],
): string | null {
  if (!input.name.trim()) return 'Vul een naam in voor deze preset.'
  if (!input.exercises.length) return 'Voeg minimaal één oefening toe aan de preset.'

  const exerciseIds = new Set<string>()
  const availableExerciseIds = new Set(exerciseCatalog.map((exercise) => exercise.id))

  for (const exercise of input.exercises) {
    if (!availableExerciseIds.has(String(exercise.exerciseId))) {
      return 'Een oefening uit deze preset bestaat niet meer. Verwijder deze en probeer opnieuw.'
    }
    if (exerciseIds.has(String(exercise.exerciseId))) {
      return 'Dezelfde oefening kan maar één keer in een preset staan.'
    }
    if (!Number.isInteger(exercise.defaultSets) || exercise.defaultSets < MIN_DEFAULT_SETS || exercise.defaultSets > MAX_DEFAULT_SETS) {
      return 'Het aantal sets moet tussen 1 en 10 liggen.'
    }
    exerciseIds.add(String(exercise.exerciseId))
  }

  const isUpdating = Boolean(input.id && existingPresets.some((preset) => preset.id === input.id))
  if (!isUpdating && existingPresets.length >= MAX_WORKOUT_PRESETS) {
    return 'Je hebt het maximum van 10 presets bereikt.'
  }

  return null
}

export function saveWorkoutPreset(input: WorkoutPresetInput): WorkoutPresetSaveResult {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Presets kunnen hier niet worden opgeslagen.' }
  }

  const existingPresets = loadWorkoutPresets()
  const existingPreset = input.id ? existingPresets.find((preset) => preset.id === input.id) : undefined

  if (input.id && !existingPreset) {
    return { success: false, error: 'Deze preset bestaat niet meer.' }
  }

  const validationError = validateWorkoutPreset(input, existingPresets)
  if (validationError) return { success: false, error: validationError }

  const now = new Date().toISOString()
  const exercises = input.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((exercise, index) => ({
      exerciseId: String(exercise.exerciseId),
      order: index + 1,
      defaultSets: exercise.defaultSets,
    }))
  const preset: WorkoutPreset = {
    id: existingPreset?.id ?? crypto.randomUUID(),
    userId: existingPreset?.userId ?? 'user-1',
    name: input.name.trim(),
    exercises,
    createdAt: existingPreset?.createdAt ?? now,
    updatedAt: now,
  }
  const nextPresets = existingPreset
    ? existingPresets.map((item) => item.id === preset.id ? preset : item)
    : [...existingPresets, preset]

  try {
    window.localStorage.setItem(WORKOUT_PRESETS_KEY, JSON.stringify(nextPresets))
    return { success: true, preset }
  } catch {
    return { success: false, error: 'Opslaan is niet gelukt. Probeer het opnieuw.' }
  }
}

export function deleteWorkoutPreset(presetId: string): boolean {
  if (typeof window === 'undefined') return false

  try {
    const nextPresets = loadWorkoutPresets().filter((preset) => preset.id !== presetId)
    window.localStorage.setItem(WORKOUT_PRESETS_KEY, JSON.stringify(nextPresets))
    return true
  } catch {
    return false
  }
}

export function createWorkoutExercisesFromPreset(preset: WorkoutPreset): {
  exercises: WorkoutExerciseItem[]
  missingExerciseCount: number
} {
  const exerciseById = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]))
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

      const performance = getExercisePerformance(exercise.id)
      return [{
        id: `${exercise.id}-${crypto.randomUUID()}`,
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        secondaryMuscleGroup: exercise.secondaryMuscleGroup,
        type: exercise.type,
        ...performance,
        sets: Array.from({ length: Math.min(MAX_DEFAULT_SETS, Math.max(MIN_DEFAULT_SETS, presetExercise.defaultSets)) }, () => ({
          id: `set-${crypto.randomUUID()}`,
          weight: '',
          reps: '',
        })),
      }]
    })

  return { exercises, missingExerciseCount }
}
