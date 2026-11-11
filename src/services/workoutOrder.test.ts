import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkoutDraft } from '../types'
import { assertCompletedWorkoutOrder, moveWorkoutExercise } from './workoutOrder'
import { createWorkoutDraftSaveQueue } from './workoutDraftSaveQueue'
import { loadWorkoutSessionDraft, saveWorkoutSessionDraft, saveCompletedWorkout, loadCompletedWorkouts, toCompletedWorkout } from './workoutStore'

function makeDraft(): WorkoutDraft {
  return { id: 'workout', name: 'Training', startedAt: '2026-11-11T10:00:00Z', presetId: 'preset', exercises: ['9', '10', '11'].map((exerciseId, index) => ({
    id: `item-${exerciseId}`, exerciseId, name: `Oefening ${exerciseId}`, muscleGroup: 'Borst', type: 'Kabel', description: 'Bewaarde instructie',
    previousPerformance: 'Vorige keer: 40 kg', personalRecord: 'PR: 50 kg',
    sets: [{ id: `set-${index}-1`, weight: '42.5', reps: '8' }, { id: `set-${index}-2`, weight: '45', reps: '6' }],
  })) }
}

afterEach(() => vi.unstubAllGlobals())

describe('active workout exercise order', () => {
  it('moves an entire exercise one position without recreating any exercise or set', () => {
    const draft = makeDraft()
    const moved = moveWorkoutExercise(draft, 'item-10', -1)!
    expect(moved.exercises.map((exercise) => exercise.id)).toEqual(['item-10', 'item-9', 'item-11'])
    expect(moved.exercises[0]).toBe(draft.exercises[1])
    expect(moved.exercises[0].sets).toBe(draft.exercises[1].sets)
    expect(moveWorkoutExercise(moved, 'item-10', 1)).toEqual(draft)
    expect(draft.exercises.map((exercise) => exercise.id)).toEqual(['item-9', 'item-10', 'item-11'])
    expect(moved.presetId).toBe(draft.presetId)
  })

  it('ignores boundaries, unknown IDs, locked workouts and completed workouts', () => {
    const draft = makeDraft()
    expect(moveWorkoutExercise(draft, 'item-9', -1)).toBe(draft)
    expect(moveWorkoutExercise(draft, 'item-11', 1)).toBe(draft)
    expect(moveWorkoutExercise(draft, 'unknown', 1)).toBe(draft)
    expect(moveWorkoutExercise(draft, 'item-9', 1, true)).toBe(draft)
    expect(moveWorkoutExercise(null, 'item-9', 1)).toBeNull()
    const completed = toCompletedWorkout(draft.name, draft.exercises, draft.startedAt)
    expect(moveWorkoutExercise(completed, completed.exercises[0].id, 1)).toBe(completed)
  })

  it('applies rapid consecutive changes to the latest state', () => {
    let draft = makeDraft()
    draft = moveWorkoutExercise(draft, 'item-9', 1)!
    draft = moveWorkoutExercise(draft, 'item-9', 1)!
    expect(draft.exercises.map((exercise) => exercise.id)).toEqual(['item-10', 'item-11', 'item-9'])
    expect(draft.exercises[2].sets.map((set) => set.weight)).toEqual(['42.5', '45'])
  })

  it('restores reordered drafts and keeps the final order in stored history', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } })
    const draft = moveWorkoutExercise(makeDraft(), 'item-11', -1)!
    saveWorkoutSessionDraft(draft)
    const restored = loadWorkoutSessionDraft()!
    expect(restored).toEqual(draft)
    const completed = toCompletedWorkout(restored.name, restored.exercises, restored.startedAt, restored.presetId, restored.id)
    saveCompletedWorkout(completed)
    expect(loadCompletedWorkouts()[0].exercises.map((exercise) => [exercise.exerciseId, exercise.order])).toEqual([['9', 1], ['11', 2], ['10', 3]])
    expect(() => saveCompletedWorkout({ ...completed, exercises: completed.exercises.toReversed() })).toThrow('staat vast')
    expect(loadCompletedWorkouts()).toEqual([completed])
    expect(() => assertCompletedWorkoutOrder(completed, [completed])).not.toThrow()
    expect(() => assertCompletedWorkoutOrder({ ...completed, exercises: completed.exercises.slice(1) }, [completed])).toThrow('staat vast')
  })

  it('serializes slow autosaves, flushes the latest order, and recovers after a failed save', async () => {
    const draft = makeDraft()
    const latest = moveWorkoutExercise(draft, 'item-9', 1)!
    let release!: () => void
    const persist = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve })).mockResolvedValue(undefined)
    const queue = createWorkoutDraftSaveQueue(persist)
    const first = queue.save(draft)
    const second = queue.save(latest)
    await Promise.resolve()
    expect(persist).toHaveBeenCalledTimes(1)
    release()
    await Promise.all([first, second, queue.flush()])
    expect(persist.mock.calls.map(([saved]) => saved.exercises.map((exercise: { id: string }) => exercise.id))).toEqual([['item-9', 'item-10', 'item-11'], ['item-10', 'item-9', 'item-11']])
    persist.mockRejectedValueOnce(new Error('offline'))
    await expect(queue.save(draft)).rejects.toThrow('offline')
    await queue.save(latest)
    expect(persist).toHaveBeenLastCalledWith(latest)
  })
})
