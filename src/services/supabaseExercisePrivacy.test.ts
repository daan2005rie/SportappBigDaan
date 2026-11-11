import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  filters: [] as Array<{ table: string; field: string; value: unknown }>,
  updates: [] as Array<{ table: string; values: Record<string, unknown> }>,
}))

vi.mock('./database', () => ({ supabase: supabaseMocks }))

import { archivePersonalExercise, loadCompletedWorkouts, loadPersonalExercises, loadTopExerciseSets, saveCompletedWorkout, createWorkoutExercisesFromPreset, saveWorkoutSessionDraft, validateWorkout } from './supabaseFitnessStore'
import { exerciseCatalog } from '../data/exercises'
import type { WorkoutDraft, WorkoutExerciseItem } from '../types'

beforeEach(() => {
  supabaseMocks.rpc.mockResolvedValue({ data: null, error: null })
  supabaseMocks.filters = []
  supabaseMocks.updates = []
  supabaseMocks.rows = {
    personal_exercises: [
      { id: 'personal-owner', user_id: 'owner-a', name: 'Eigen oefening', archived_at: null },
      { id: 'personal-other', user_id: 'owner-b', name: 'Andermans oefening', archived_at: null },
    ],
    workouts: [
      { id: 'workout-owner', user_id: 'owner-a', name: 'Eigen workout', started_at: '2026-10-01T10:00:00.000Z', completed_at: '2026-10-01T11:00:00.000Z', created_at: '2026-10-01T11:00:00.000Z', preset_id: null },
      { id: 'workout-other', user_id: 'owner-b', name: 'Andermans workout', started_at: '2026-10-02T10:00:00.000Z', completed_at: '2026-10-02T11:00:00.000Z', created_at: '2026-10-02T11:00:00.000Z', preset_id: null },
    ],
    workout_exercises: [
      { id: 'exercise-owner', workout_id: 'workout-owner', user_id: 'owner-a', exercise_id: '9', exercise_order: 1, exercise_name: null, primary_muscles: null, secondary_muscles: null, description: null, equipment: null, movement_type: null },
      { id: 'exercise-other', workout_id: 'workout-other', user_id: 'owner-b', exercise_id: '9', exercise_order: 1, exercise_name: null, primary_muscles: null, secondary_muscles: null, description: null, equipment: null, movement_type: null },
    ],
    workout_sets: [
      { id: 'set-owner', workout_exercise_id: 'exercise-owner', user_id: 'owner-a', set_number: 1, weight_kg: 80, reps: 8 },
      { id: 'set-other', workout_exercise_id: 'exercise-other', user_id: 'owner-b', set_number: 1, weight_kg: 300, reps: 20 },
    ],
  }
  supabaseMocks.auth.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } }, error: null })
  supabaseMocks.from.mockImplementation((table: string) => {
    let rows = supabaseMocks.rows[table]
    const query = {
      select: () => query,
      update: (values: Record<string, unknown>) => {
        supabaseMocks.updates.push({ table, values })
        return query
      },
      eq: (field: string, value: unknown) => {
        supabaseMocks.filters.push({ table, field, value })
        rows = rows.filter((row) => row[field] === value)
        return query
      },
      is: (field: string, value: unknown) => {
        rows = rows.filter((row) => row[field] === value)
        return query
      },
      in: (field: string, values: unknown[]) => {
        rows = rows.filter((row) => values.includes(row[field]))
        return query
      },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      order: () => query,
      then: (resolve: (result: { data: Array<Record<string, unknown>>; error: null }) => unknown) => (
        Promise.resolve({ data: rows, error: null }).then(resolve)
      ),
    }
    return query
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('loadTopExerciseSets', () => {
  it('loads and ranks only workouts filtered to the authenticated user', async () => {
    const topSets = await loadTopExerciseSets('9')

    expect(topSets).toHaveLength(1)
    expect(topSets[0]).toMatchObject({ workoutId: 'workout-owner', weight: 80, reps: 8 })
    expect(topSets.some((set) => set.workoutId === 'workout-other')).toBe(false)
    expect(supabaseMocks.filters).toContainEqual({ table: 'workouts', field: 'user_id', value: 'owner-a' })
  })

  it("archives only the authenticated owner's exercise without deleting it", async () => {
    await expect(archivePersonalExercise('personal-owner')).resolves.toBeUndefined()

    expect(supabaseMocks.updates).toHaveLength(1)
    expect(supabaseMocks.updates[0].table).toBe('personal_exercises')
    expect(supabaseMocks.updates[0].values).toHaveProperty('archived_at')
    expect(supabaseMocks.filters).toContainEqual({ table: 'personal_exercises', field: 'id', value: 'personal-owner' })
    expect(supabaseMocks.filters).toContainEqual({ table: 'personal_exercises', field: 'user_id', value: 'owner-a' })
  })
})

describe('historical exercise snapshots', () => {
  it('keeps the saved name, description and empty muscle arrays when the library changed', async () => {
    Object.assign(supabaseMocks.rows.workout_exercises[0], {
      exercise_name: 'Historische naam', description: 'Historische uitleg',
      primary_muscles: ['Borst'], secondary_muscles: [], equipment: '', movement_type: '',
    })
    const [workout] = await loadCompletedWorkouts()
    expect(workout.exercises[0]).toMatchObject({
      name: 'Historische naam', description: 'Historische uitleg', primaryMuscles: ['Borst'],
      secondaryMuscles: [], type: '', movementType: '',
    })
    await saveCompletedWorkout(workout)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('persist_workout', {
      p_workout: expect.objectContaining({ exercises: [expect.objectContaining({
        exerciseId: '9', name: 'Historische naam', description: 'Historische uitleg',
        primaryMuscles: ['Borst'], secondaryMuscles: [],
      })] }),
    })
  })

  it('still resolves legacy standard workout rows without snapshot columns', async () => {
    const [workout] = await loadCompletedWorkouts()
    expect(workout.exercises[0].name).not.toContain('Onbekende')
    expect(workout.exercises[0].primaryMuscles?.length).toBeGreaterThan(0)
  })

  it('uses catalog metadata for an old frontend payload and sends that fallback on resave', async () => {
    const standard = exerciseCatalog.find((exercise) => exercise.id === '9')!
    const [workout] = await loadCompletedWorkouts()
    expect(workout.exercises[0]).toMatchObject({
      name: standard.name, description: standard.description,
      primaryMuscles: standard.primaryMuscleGroups, secondaryMuscles: standard.secondaryMuscles,
    })
    await saveCompletedWorkout(workout)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('persist_workout', {
      p_workout: expect.objectContaining({ exercises: [expect.objectContaining({
        name: standard.name, description: standard.description,
        primaryMuscles: standard.primaryMuscleGroups, secondaryMuscles: standard.secondaryMuscles,
      })] }),
    })
    // Reading/resaving must never repair stored history by direct table updates.
    expect(supabaseMocks.updates).toEqual([])
    expect(supabaseMocks.rows.workout_exercises[0].primary_muscles).toBeNull()
  })

  it('recognizes the old RPC bug: two empty arrays with otherwise absent standard metadata', async () => {
    Object.assign(supabaseMocks.rows.workout_exercises[0], { primary_muscles: [], secondary_muscles: [] })
    const standard = exerciseCatalog.find((exercise) => exercise.id === '9')!
    const [workout] = await loadCompletedWorkouts()
    expect(workout.exercises[0].primaryMuscles).toEqual(standard.primaryMuscleGroups)
    expect(workout.exercises[0].secondaryMuscles).toEqual(standard.secondaryMuscles)
    await saveCompletedWorkout(workout)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('persist_workout', {
      p_workout: expect.objectContaining({ exercises: [expect.objectContaining({
        primaryMuscles: standard.primaryMuscleGroups, secondaryMuscles: standard.secondaryMuscles,
      })] }),
    })
    expect(supabaseMocks.rows.workout_exercises[0].primary_muscles).toEqual([])
  })

  it('falls back for snapshot properties absent from a legacy result object', async () => {
    for (const field of ['exercise_name', 'primary_muscles', 'secondary_muscles', 'description', 'equipment', 'movement_type']) {
      delete supabaseMocks.rows.workout_exercises[0][field]
    }
    const standard = exerciseCatalog.find((exercise) => exercise.id === '9')!
    const [workout] = await loadCompletedWorkouts()
    expect(workout.exercises[0]).toMatchObject({
      name: standard.name, primaryMuscles: standard.primaryMuscleGroups, secondaryMuscles: standard.secondaryMuscles,
    })
  })

  it('resolves missing individual fields without replacing a partial snapshot or explicit empty values', async () => {
    Object.assign(supabaseMocks.rows.workout_exercises[0], {
      exercise_name: 'Oorspronkelijke naam', primary_muscles: ['Rug'],
      description: '', equipment: '', secondary_muscles: null,
    })
    const standard = exerciseCatalog.find((exercise) => exercise.id === '9')!
    const [workout] = await loadCompletedWorkouts()
    expect(workout.exercises[0]).toMatchObject({
      name: 'Oorspronkelijke naam', primaryMuscles: ['Rug'], description: '', type: '',
      secondaryMuscles: standard.secondaryMuscles,
    })
  })

  it('does not infer absent snapshots from intentional empty arrays on a named snapshot', async () => {
    Object.assign(supabaseMocks.rows.workout_exercises[0], {
      exercise_name: 'Bewaarde lege velden', primary_muscles: [], secondary_muscles: [],
    })
    const [workout] = await loadCompletedWorkouts()
    expect(workout.exercises[0]).toMatchObject({
      name: 'Bewaarde lege velden', primaryMuscles: [], secondaryMuscles: [],
    })
  })

  it('never resolves personal history from the current personal library', async () => {
    Object.assign(supabaseMocks.rows.workout_exercises[0], {
      exercise_id: 'personal-owner', exercise_name: 'Oude eigen naam',
      description: 'Oude instructie', primary_muscles: ['Borst'], secondary_muscles: [],
    })
    const [workout] = await loadCompletedWorkouts()
    expect(workout.exercises[0]).toMatchObject({
      name: 'Oude eigen naam', description: 'Oude instructie', primaryMuscles: ['Borst'], secondaryMuscles: [],
    })
    expect(supabaseMocks.from).not.toHaveBeenCalledWith('personal_exercises')
  })
})

describe('personal exercise availability', () => {
  it('loads active exercises for selection, but includes archives when resolving existing references', async () => {
    supabaseMocks.rows.personal_exercises.push({
      id: 'archived-owner', user_id: 'owner-a', name: 'Archief', archived_at: '2026-10-01',
      primary_muscles: ['Borst'], secondary_muscles: [],
    })
    Object.assign(supabaseMocks.rows.personal_exercises[0], { primary_muscles: ['Borst'], secondary_muscles: [] })
    expect((await loadPersonalExercises()).map((exercise) => exercise.id)).toEqual(['personal-owner'])
    expect((await loadPersonalExercises(true)).map((exercise) => exercise.id)).toEqual(['personal-owner', 'archived-owner'])
  })

  it('starts existing presets containing an archived personal exercise', async () => {
    const result = await createWorkoutExercisesFromPreset({
      id: 'preset-owner', userId: 'owner-a', name: 'Bestaande preset', createdAt: '', updatedAt: '',
      exercises: [{ exerciseId: 'archived-owner', order: 1, defaultSets: 2 }],
    }, [{
      id: 'archived-owner', userId: 'owner-a', name: 'Archief', archivedAt: '2026-10-01',
      muscleGroup: 'Borst', primaryMuscleGroups: ['Borst'], secondaryMuscles: [], type: 'Kabel',
    }])
    expect(result.missingExerciseCount).toBe(0)
    expect(result.exercises[0]).toMatchObject({ exerciseId: 'archived-owner', name: 'Archief' })
    expect(result.exercises[0].sets).toHaveLength(2)
  })
})

describe('set compatibility', () => {
  const exercise: WorkoutExerciseItem = {
    id: 'draft-exercise', exerciseId: '9', name: 'Bench Press', muscleGroup: 'Borst', type: 'Barbell',
    sets: [{ id: 'draft-set', weight: '0', reps: '8' }],
  }

  it.each(['0', '0.5', '.5', '1e1', ' 20 '])('accepts valid new-workout weight %s', (weight) => {
    expect(validateWorkout([{ ...exercise, sets: [{ id: 'set', weight, reps: '8' }] }])).toBeNull()
  })

  it.each(['-1', 'NaN', 'Infinity', 'not-a-number'])('rejects invalid new-workout weight %s', (weight) => {
    expect(validateWorkout([{ ...exercise, sets: [{ id: 'set', weight, reps: '8' }] }])).not.toBeNull()
  })

  it('retains the positive-repetition rule for newly completed workouts', () => {
    expect(validateWorkout([{ ...exercise, sets: [{ id: 'set', weight: '0', reps: '0' }] }])).not.toBeNull()
  })

  it('passes historical zero-repetition results through unchanged on resave', async () => {
    supabaseMocks.rows.workout_sets[0].reps = 0
    supabaseMocks.rows.workout_sets[0].weight_kg = 0
    const [workout] = await loadCompletedWorkouts()
    await saveCompletedWorkout(workout)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('persist_workout', {
      p_workout: expect.objectContaining({ exercises: [expect.objectContaining({
        sets: [{ setNumber: 1, weight: 0, reps: 0 }],
      })] }),
    })
  })

  it.each<{ sets: WorkoutExerciseItem['sets'] }>([
    { sets: [] },
    { sets: [{ id: 'blank-set', weight: '', reps: '' }] },
  ])('preserves incomplete draft sets $sets', async ({ sets }) => {
    const draft: WorkoutDraft = {
      id: 'draft', name: 'Actieve workout', startedAt: '2026-10-01T10:00:00Z',
      exercises: [{ ...exercise, sets }],
    }
    await saveWorkoutSessionDraft(draft)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('persist_workout_draft', { p_draft: draft })
    expect(draft.exercises[0].sets).toEqual(sets)
  })
})
