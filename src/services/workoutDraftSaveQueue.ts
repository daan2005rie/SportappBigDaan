import type { WorkoutDraft } from '../types'

/** Keep older network requests from overwriting newer workout snapshots. */
export function createWorkoutDraftSaveQueue(persist: (draft: WorkoutDraft) => Promise<void>) {
  let pending = Promise.resolve()
  return {
    save(draft: WorkoutDraft) {
      const operation = pending.then(() => persist(draft))
      // Report each failure to its caller, but allow subsequent saves to proceed.
      pending = operation.catch(() => {})
      return operation
    },
    flush() { return pending },
  }
}
