import { describe, expect, it } from 'vitest'

import type { CompletedWorkout, Exercise } from '../types'
import { navigationItems } from '../data/dashboard'
import { exerciseCatalog } from '../data/exercises'
import { filterExercises, getSelectableExercises } from './exerciseLibrary'
import { getTopExerciseSets } from './workoutStore'

const exercises: Exercise[] = [
  { id: '1', name: 'Bench Press', muscleGroup: 'Borst', type: 'Barbell' },
  { id: '2', name: 'Cable Row', muscleGroup: 'Rug', type: 'Kabel' },
]

function workout(id: string, completedAt: string, sets: { weight: number; reps: number }[]): CompletedWorkout {
  return {
    id,
    name: `Workout ${id}`,
    startedAt: completedAt,
    completedAt,
    createdAt: completedAt,
    exercises: [{
      id: `exercise-${id}`,
      exerciseId: '1',
      name: 'Bench Press',
      muscleGroup: 'Borst',
      type: 'Barbell',
      order: 1,
      sets: sets.map((set, index) => ({ id: `${id}-set-${index}`, setNumber: index + 1, ...set })),
    }],
  }
}

describe('filterExercises', () => {
  it('keeps all 220 standard exercises and their source descriptions and muscle groups', () => {
    expect(exerciseCatalog).toHaveLength(220)
    expect(exerciseCatalog.every((exercise) => (
      exercise.description?.trim()
      && exercise.primaryMuscleGroups?.length
      && Array.isArray(exercise.secondaryMuscles)
    ))).toBe(true)
  })

  it('searches names without case sensitivity or surrounding whitespace', () => {
    expect(filterExercises(exercises, '  bEnCh ')).toEqual([exercises[0]])
    expect(filterExercises(exercises, 'press')).toEqual([exercises[0]])
    expect(filterExercises(exercises, 'not found')).toEqual([])
  })

  it('places Exercises between Workout and My Workouts in the shared navigation', () => {
    const labels = navigationItems.map((item) => item.label)
    expect(labels.slice(labels.indexOf('Workout'), labels.indexOf('Mijn workouts') + 1)).toEqual([
      'Workout',
      'Oefeningen',
      'Mijn workouts',
    ])
  })
})

describe('getTopExerciseSets', () => {
  it('returns at most five sets ordered by weight, then reps, from the supplied workouts', () => {
    const ownWorkouts = [
      workout('own-1', '2026-10-01T10:00:00.000Z', [
        { weight: 80, reps: 10 },
        { weight: 100, reps: 5 },
        { weight: 100, reps: 8 },
      ]),
      workout('own-2', '2026-10-02T10:00:00.000Z', [
        { weight: 90, reps: 10 },
        { weight: 70, reps: 12 },
        { weight: 85, reps: 6 },
      ]),
    ]
    const topSets = getTopExerciseSets('1', ownWorkouts)
    expect(topSets).toHaveLength(5)
    expect(topSets.map(({ weight, reps }) => [weight, reps])).toEqual([
      [100, 8],
      [100, 5],
      [90, 10],
      [85, 6],
      [80, 10],
    ])
    expect(getTopExerciseSets('2', ownWorkouts)).toEqual([])
  })
})

describe('new exercise selection', () => {
  it('excludes archives while retaining active personal and standard exercises', () => {
    const personal = {
      id: 'personal', userId: 'owner', name: 'Eigen', muscleGroup: 'Borst',
      primaryMuscleGroups: ['Borst'], secondaryMuscles: [], type: 'Kabel', archivedAt: null,
    }
    expect(getSelectableExercises(exercises, [personal, {
      ...personal, id: 'archived', archivedAt: '2026-10-01',
    }]).map((exercise) => exercise.id)).toEqual(['1', '2', 'personal'])
  })
})
