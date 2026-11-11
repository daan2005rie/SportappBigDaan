import type { CompletedWorkout, WorkoutDraft } from '../types'

export function moveWorkoutExercise(workout: CompletedWorkout, exerciseId: string, direction: -1 | 1, locked?: boolean): CompletedWorkout
export function moveWorkoutExercise(workout: WorkoutDraft | null, exerciseId: string, direction: -1 | 1, locked?: boolean): WorkoutDraft | null
export function moveWorkoutExercise(
  workout: WorkoutDraft | CompletedWorkout | null,
  exerciseId: string,
  direction: -1 | 1,
  locked = false,
): WorkoutDraft | CompletedWorkout | null {
  if (!workout || locked || 'completedAt' in workout) return workout
  const index = workout.exercises.findIndex((exercise) => exercise.id === exerciseId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= workout.exercises.length) return workout
  const exercises = [...workout.exercises]
  ;[exercises[index], exercises[nextIndex]] = [exercises[nextIndex], exercises[index]]
  return { ...workout, exercises }
}

export function assertCompletedWorkoutOrder(workout: CompletedWorkout, previousWorkouts: CompletedWorkout[]) {
  const previous = previousWorkouts.find((item) => item.id === workout.id)
  if (!previous) return
  const savedIds = previous.exercises.toSorted((a, b) => a.order - b.order).map((exercise) => exercise.exerciseId)
  const newIds = workout.exercises.map((exercise) => exercise.exerciseId)
  if (savedIds.length !== newIds.length || savedIds.some((id, index) => id !== newIds[index])) {
    throw new Error('De oefenvolgorde van een afgeronde workout staat vast.')
  }
}
