import type { Exercise, PersonalExercise } from '../types'

export function filterExercises(exercises: Exercise[], query: string): Exercise[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL')
  if (!normalizedQuery) return exercises
  return exercises.filter((exercise) => exercise.name.toLocaleLowerCase('nl-NL').includes(normalizedQuery))
}

/** Archived exercises remain resolvable in history/presets, but cannot be new choices. */
export function getSelectableExercises(standard: Exercise[], personal: PersonalExercise[]): Exercise[] {
  return [...standard, ...personal.filter((exercise) => !exercise.archivedAt)]
}
