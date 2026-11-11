import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// Opt in explicitly. Never accept an online Supabase endpoint in this suite.
const enabled = process.env.SPORTAPP_LOCAL_API_TESTS === '1'
const url = process.env.SPORTAPP_LOCAL_API_URL ?? 'http://127.0.0.1:55321'
if (enabled && url !== 'http://127.0.0.1:55321') throw new Error('Only the isolated local API is permitted.')

vi.mock('../../src/services/database', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const endpoint = process.env.SPORTAPP_LOCAL_API_URL ?? 'http://127.0.0.1:55321'
  if (endpoint !== 'http://127.0.0.1:55321') throw new Error('Online endpoints are forbidden.')
  return { supabase: createClient(endpoint, process.env.SPORTAPP_LOCAL_ANON_KEY ?? 'local-tests-disabled', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) }
})

import { supabase } from '../../src/services/database'
import {
  archivePersonalExercise, createWorkoutExercisesFromPreset, loadCompletedWorkouts,
  loadExerciseById, loadPersonalExercises, loadTopExerciseSets, loadWorkoutPresets,
  loadWorkoutSessionDraft, saveCompletedWorkout, savePersonalExercise, saveWorkoutPreset,
  saveWorkoutSessionDraft,
} from '../../src/services/supabaseFitnessStore'
import { getSelectableExercises } from '../../src/services/exerciseLibrary'
import { exerciseCatalog } from '../../src/data/exercises'
import { toCompletedWorkout } from '../../src/services/workoutStore'

describe.runIf(enabled)('real local Auth/PostgREST workflow', () => {
  let exerciseId: string
  let presetId: string
  let workoutId: string
  let draftId: string

  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.SPORTAPP_LOCAL_EMAIL!, password: process.env.SPORTAPP_LOCAL_PASSWORD!,
    })
    if (error) throw error
  })

  it('adds and resolves a private personal exercise through the actual app service', async () => {
    const exercise = await savePersonalExercise({
      name: 'Local integration press', description: 'Original instruction',
      primaryMuscleGroups: ['Borst'], secondaryMuscles: ['Triceps'], equipment: 'Kabel', movementType: 'Compound',
    })
    exerciseId = exercise.id
    expect(await loadExerciseById(exerciseId)).toMatchObject({ name: 'Local integration press' })
    expect((await loadPersonalExercises()).map((item) => item.id)).toContain(exerciseId)
  })

  it('creates a preset, starts an unfinished draft and completes a workout with that exercise', async () => {
    const preset = await saveWorkoutPreset({ name: 'Local integration preset', exercises: [{ exerciseId, order: 1, defaultSets: 2 }] })
    presetId = preset.id
    const result = await createWorkoutExercisesFromPreset(preset, await loadPersonalExercises(true))
    expect(result.missingExerciseCount).toBe(0)
    expect(result.exercises[0].sets).toHaveLength(2)
    draftId = crypto.randomUUID()
    const startedAt = new Date().toISOString()
    await saveWorkoutSessionDraft({ id: draftId, name: preset.name, presetId, startedAt, exercises: result.exercises })
    expect((await loadWorkoutSessionDraft())?.exercises[0].sets[0].weight).toBe('')
    result.exercises[0].sets = [
      { id: crypto.randomUUID(), weight: '40', reps: '8' },
      { id: crypto.randomUUID(), weight: '50', reps: '6' },
    ]
    const workout = toCompletedWorkout(preset.name, result.exercises, startedAt, presetId, draftId)
    workoutId = workout.id
    await saveCompletedWorkout(workout)
    expect(await loadWorkoutSessionDraft()).toBeNull()
    expect(await loadTopExerciseSets(exerciseId)).toMatchObject([{ weight: 50, reps: 6 }, { weight: 40, reps: 8 }])
  })

  it('preserves snapshots after a rename, archive and historical resave', async () => {
    await savePersonalExercise({ id: exerciseId, name: 'Renamed integration press', description: 'Changed instruction',
      primaryMuscleGroups: ['Rug'], secondaryMuscles: ['Biceps'], equipment: 'Kabel', movementType: 'Compound' })
    await archivePersonalExercise(exerciseId)
    const [workout] = (await loadCompletedWorkouts()).filter((item) => item.id === workoutId)
    expect(workout.exercises[0]).toMatchObject({ name: 'Local integration press', description: 'Original instruction', primaryMuscles: ['Borst'] })
    await saveCompletedWorkout(workout)
    const resaved = (await loadCompletedWorkouts()).find((item) => item.id === workoutId)!
    expect(resaved.exercises[0]).toMatchObject({ name: 'Local integration press', description: 'Original instruction', primaryMuscles: ['Borst'] })
    expect(getSelectableExercises(exerciseCatalog, await loadPersonalExercises(true)).some((item) => item.id === exerciseId)).toBe(false)
  })

  it('allows existing archived preset references but rejects adding the archive to a new preset/workout', async () => {
    const preset = (await loadWorkoutPresets()).find((item) => item.id === presetId)!
    const result = await createWorkoutExercisesFromPreset(preset, await loadPersonalExercises(true))
    expect(result.missingExerciseCount).toBe(0)
    await saveWorkoutPreset({ id: presetId, name: 'Renamed existing preset', exercises: preset.exercises })
    draftId = crypto.randomUUID()
    await saveWorkoutSessionDraft({ id: draftId, name: preset.name, presetId, startedAt: new Date().toISOString(), exercises: result.exercises })
    expect((await loadWorkoutSessionDraft())?.exercises[0].exerciseId).toBe(exerciseId)
    await expect(saveWorkoutPreset({ name: 'Forbidden new preset', exercises: preset.exercises })).rejects.toThrow()
    await expect(saveWorkoutSessionDraft({ id: crypto.randomUUID(), name: 'Forbidden new draft', startedAt: new Date().toISOString(), exercises: result.exercises })).rejects.toThrow()
  })

  it('blocks account B from reading or using account A’s exercise through HTTP', async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: process.env.SPORTAPP_LOCAL_OTHER_EMAIL!, password: process.env.SPORTAPP_LOCAL_PASSWORD! })
    if (error) throw error
    expect(await loadExerciseById(exerciseId)).toBeNull()
    expect(await loadPersonalExercises(true)).toEqual([])
    expect(await loadTopExerciseSets(exerciseId)).toEqual([])
    await expect(saveWorkoutPreset({ name: 'Cross-user preset', exercises: [{ exerciseId, order: 1, defaultSets: 2 }] })).rejects.toThrow()
  })

  it('blocks requests without a session through the public API', async () => {
    const anonymous = createClient(url, process.env.SPORTAPP_LOCAL_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await anonymous.from('personal_exercises').select('id')
    expect(error).not.toBeNull()
    const { error: rpcError } = await anonymous.rpc('persist_workout_draft', { p_draft: { name: 'Anonymous', startedAt: new Date().toISOString(), exercises: [] } })
    expect(rpcError).not.toBeNull()
  })
})
