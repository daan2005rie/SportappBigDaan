import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkoutPreset } from '../types'
import {
  createWorkoutExercisesFromPreset,
  deleteWorkoutPreset,
  loadWorkoutPresets,
  saveWorkoutPreset,
  validateWorkoutPreset,
} from './workoutPresetStore'
import { getExercisePerformance, saveCompletedWorkout } from './workoutStore'

const createPresetInput = (name = 'Push Day') => ({
  name,
  exercises: [{ exerciseId: '9', order: 1, defaultSets: 3 }],
})

const createStoredPreset = (index: number): WorkoutPreset => ({
  id: `preset-${index}`,
  userId: 'user-1',
  name: `Preset ${index}`,
  exercises: [{ exerciseId: '9', order: 1, defaultSets: 3 }],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
})

let storage: Map<string, string>

beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('validateWorkoutPreset', () => {
  it('rejects missing names, empty presets, duplicate or unavailable exercises, and invalid set counts', () => {
    expect(validateWorkoutPreset({ ...createPresetInput('  ') })).toContain('naam')
    expect(validateWorkoutPreset({ name: 'Leeg', exercises: [] })).toContain('minimaal één')
    expect(validateWorkoutPreset({
      name: 'Dubbel',
      exercises: [
        { exerciseId: '9', order: 1, defaultSets: 3 },
        { exerciseId: '9', order: 2, defaultSets: 3 },
      ],
    })).toContain('maar één keer')
    expect(validateWorkoutPreset({
      name: 'Ongeldige sets',
      exercises: [{ exerciseId: '9', order: 1, defaultSets: 11 }],
    })).toContain('tussen 1 en 10')
    expect(validateWorkoutPreset({
      name: 'Onbekend',
      exercises: [{ exerciseId: 'not-in-catalog', order: 1, defaultSets: 3 }],
    })).toContain('bestaat niet meer')
  })

  it('enforces ten presets while allowing an existing preset to be edited', () => {
    const tenPresets = Array.from({ length: 10 }, (_, index) => createStoredPreset(index))
    expect(validateWorkoutPreset(createPresetInput('Nieuwe'), tenPresets)).toContain('maximum van 10')
    expect(validateWorkoutPreset({ ...createPresetInput('Bewerkt'), id: tenPresets[0].id }, tenPresets)).toBeNull()
  })
})

describe('saveWorkoutPreset', () => {
  it('creates, updates, and deletes presets without changing workout history', () => {
    const history = '[{"id":"completed-workout"}]'
    storage.set('bigdaan.completed-workouts.v1', history)

    const createdResult = saveWorkoutPreset(createPresetInput())
    if (!createdResult.success) throw new Error(createdResult.error)
    expect(loadWorkoutPresets()).toHaveLength(1)

    const updatedResult = saveWorkoutPreset({
      ...createPresetInput('Upper Body'),
      id: createdResult.preset.id,
      exercises: [{ exerciseId: '9', order: 1, defaultSets: 5 }],
    })
    if (!updatedResult.success) throw new Error(updatedResult.error)
    expect(updatedResult.preset.id).toBe(createdResult.preset.id)
    expect(updatedResult.preset.createdAt).toBe(createdResult.preset.createdAt)
    expect(updatedResult.preset.exercises[0].defaultSets).toBe(5)

    expect(deleteWorkoutPreset(updatedResult.preset.id)).toBe(true)
    expect(loadWorkoutPresets()).toEqual([])
    expect(storage.get('bigdaan.completed-workouts.v1')).toBe(history)
  })

  it('enforces the maximum during persistence, not only validation', () => {
    for (let index = 0; index < 10; index += 1) {
      const result = saveWorkoutPreset(createPresetInput(`Preset ${index}`))
      expect(result.success).toBe(true)
    }

    const result = saveWorkoutPreset(createPresetInput('Preset 11'))
    expect(result).toMatchObject({ success: false, error: 'Je hebt het maximum van 10 presets bereikt.' })
    expect(loadWorkoutPresets()).toHaveLength(10)
  })
})

describe('createWorkoutExercisesFromPreset', () => {
  it('creates ordered workout exercises with the preset set count and empty results', () => {
    const result = createWorkoutExercisesFromPreset({
      ...createStoredPreset(1),
      exercises: [
        { exerciseId: '9', order: 1, defaultSets: 3 },
        { exerciseId: '10', order: 2, defaultSets: 2 },
      ],
    })

    expect(result.missingExerciseCount).toBe(0)
    expect(result.exercises.map((exercise) => exercise.exerciseId)).toEqual(['9', '10'])
    expect(result.exercises[0].sets).toHaveLength(3)
    expect(result.exercises[0].sets.every((set) => set.weight === '' && set.reps === '')).toBe(true)
    expect(result.exercises[1].sets).toHaveLength(2)
  })

  it('skips missing catalog exercises and reports how many were unavailable', () => {
    const result = createWorkoutExercisesFromPreset({
      ...createStoredPreset(1),
      exercises: [{ exerciseId: 'removed-exercise', order: 1, defaultSets: 3 }],
    })

    expect(result.exercises).toEqual([])
    expect(result.missingExerciseCount).toBe(1)
  })
})

describe('getExercisePerformance', () => {
  it('shows the latest workout performance and stored PR for an exercise', () => {
    saveCompletedWorkout({
      id: 'workout-1',
      name: 'Push Day',
      startedAt: '2026-10-01T10:00:00.000Z',
      completedAt: '2026-10-01T11:00:00.000Z',
      createdAt: '2026-10-01T11:00:00.000Z',
      exercises: [{
        id: 'workout-exercise-1',
        exerciseId: '9',
        name: 'Bench Press',
        muscleGroup: 'Borst',
        type: 'Barbell',
        order: 1,
        sets: [{ id: 'set-1', setNumber: 1, weight: 80, reps: 8 }],
      }],
    })

    expect(getExercisePerformance('9')).toEqual({
      previousPerformance: 'Vorige keer: 80 kg × 8',
      personalRecord: 'PR: 80 kg × 8',
    })
  })
})
