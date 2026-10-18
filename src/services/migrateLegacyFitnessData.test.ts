import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompletedWorkout, PersonalRecord } from '../types'
import { migrateLegacyFitnessData } from './migrateLegacyFitnessData'

const migrationMocks = vi.hoisted(() => ({
  loadCompletedWorkouts: vi.fn(),
  loadWorkoutPresets: vi.fn(),
  loadWorkoutSessionDraft: vi.fn(),
  saveCompletedWorkout: vi.fn(),
  saveWorkoutPreset: vi.fn(),
  saveWorkoutSessionDraft: vi.fn(),
}))

vi.mock('./supabaseFitnessStore', () => migrationMocks)

const COMPLETED_WORKOUTS_KEY = 'bigdaan.completed-workouts.v1'
const PERSONAL_RECORDS_KEY = 'bigdaan.personal-records.v1'

let storage: Map<string, string>
let cloudWorkouts: CompletedWorkout[]

function createWorkout(id: string, exerciseId = '9', weight = 100, reps = 5): CompletedWorkout {
  const exerciseName = exerciseId === '9' ? 'Bench Press' : 'Air Squat'
  return {
    id,
    name: 'Legacy workout',
    startedAt: '2026-10-01T10:00:00.000Z',
    completedAt: '2026-10-01T11:00:00.000Z',
    createdAt: '2026-10-01T11:00:00.000Z',
    exercises: [{
      id: `${id}-exercise`,
      exerciseId,
      name: exerciseName,
      muscleGroup: 'Borst',
      type: 'Barbell',
      order: 1,
      sets: [{ id: `${id}-set`, setNumber: 1, weight, reps }],
    }],
  }
}

function createRecord(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    id: 'legacy-record',
    userId: 'legacy-user',
    exerciseId: '9',
    exerciseName: 'Bench Press',
    weight: 100,
    reps: 5,
    workoutId: 'legacy-workout-1',
    achievedAt: '2026-10-01T11:00:00.000Z',
    ...overrides,
  }
}

function setLegacyData(workouts: CompletedWorkout[], records: PersonalRecord[]) {
  storage.set(COMPLETED_WORKOUTS_KEY, JSON.stringify(workouts))
  storage.set(PERSONAL_RECORDS_KEY, JSON.stringify(records))
}

function runMigration() {
  return migrateLegacyFitnessData('user-1')
}

beforeEach(() => {
  storage = new Map()
  cloudWorkouts = []
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  vi.clearAllMocks()

  migrationMocks.loadCompletedWorkouts.mockImplementation(async () => cloudWorkouts)
  migrationMocks.loadWorkoutPresets.mockResolvedValue([])
  migrationMocks.loadWorkoutSessionDraft.mockResolvedValue(null)
  migrationMocks.saveCompletedWorkout.mockImplementation(async (workout: CompletedWorkout) => {
    cloudWorkouts = [workout, ...cloudWorkouts.filter((existing) => existing.id !== workout.id)]
    return { newRecords: [] }
  })
  migrationMocks.saveWorkoutPreset.mockResolvedValue(undefined)
  migrationMocks.saveWorkoutSessionDraft.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('migrateLegacyFitnessData PR verification', () => {
  it('accepts a performance when the derived PR points to a different workout', async () => {
    const workouts = [createWorkout('legacy-workout-1', '9', 100, 5), createWorkout('legacy-workout-2', '9', 100, 8)]
    setLegacyData(workouts, [createRecord()])

    await expect(runMigration()).resolves.toBeUndefined()

    expect(migrationMocks.saveCompletedWorkout).toHaveBeenCalledTimes(2)
    expect(storage.has(COMPLETED_WORKOUTS_KEY)).toBe(false)
    expect(storage.has(PERSONAL_RECORDS_KEY)).toBe(false)
  })

  it('stops and preserves local data when the PR performance is missing', async () => {
    const workouts = [createWorkout('legacy-workout-1', '9', 90, 5)]
    const records = [createRecord()]
    setLegacyData(workouts, records)
    const storedWorkouts = storage.get(COMPLETED_WORKOUTS_KEY)
    const storedRecords = storage.get(PERSONAL_RECORDS_KEY)

    await expect(runMigration()).rejects.toThrow('Een opgeslagen PR kan niet uit de gemigreerde workoutgeschiedenis worden hersteld')

    expect(storage.get(COMPLETED_WORKOUTS_KEY)).toBe(storedWorkouts)
    expect(storage.get(PERSONAL_RECORDS_KEY)).toBe(storedRecords)
  })

  it('does not treat the same weight with different reps as the same performance', async () => {
    setLegacyData([createWorkout('legacy-workout-1', '9', 100, 8)], [createRecord()])

    await expect(runMigration()).rejects.toThrow('Een opgeslagen PR kan niet uit de gemigreerde workoutgeschiedenis worden hersteld')
  })

  it('does not treat the same weight and reps for a different exercise as the same performance', async () => {
    setLegacyData([createWorkout('legacy-workout-1', '10', 100, 5)], [createRecord()])

    await expect(runMigration()).rejects.toThrow('Een opgeslagen PR kan niet uit de gemigreerde workoutgeschiedenis worden hersteld')
  })

  it('reuses the same workout IDs on retry without creating duplicate workouts', async () => {
    setLegacyData([createWorkout('legacy-workout-1')], [createRecord()])
    migrationMocks.loadCompletedWorkouts.mockImplementationOnce(async () => [])

    await expect(runMigration()).rejects.toThrow('Niet alle workouts zijn in Supabase teruggelezen')
    expect(storage.has(COMPLETED_WORKOUTS_KEY)).toBe(true)

    await expect(runMigration()).resolves.toBeUndefined()

    const firstWorkoutId = migrationMocks.saveCompletedWorkout.mock.calls[0][0].id
    const retryWorkoutId = migrationMocks.saveCompletedWorkout.mock.calls[1][0].id
    expect(retryWorkoutId).toBe(firstWorkoutId)
    expect(cloudWorkouts).toHaveLength(1)
    expect(storage.has(COMPLETED_WORKOUTS_KEY)).toBe(false)
  })
})