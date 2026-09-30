import { describe, expect, it } from 'vitest'

import {
  detectPersonalRecords,
  getDashboardMetrics,
  getExerciseProgressForExercise,
  getTopExercisesByVolume,
  getWeeklyVolumeTrend,
} from './workoutStore'

describe('detectPersonalRecords', () => {
  it('keeps the highest weight per exercise and returns the new record entries', () => {
    const workout = {
      id: 'workout-1',
      name: 'Test workout',
      startedAt: '2026-09-30T08:00:00.000Z',
      completedAt: '2026-09-30T08:45:00.000Z',
      createdAt: '2026-09-30T08:45:00.000Z',
      exercises: [
        {
          id: 'exercise-1',
          exerciseId: 'bench-press',
          name: 'Bench Press',
          muscleGroup: 'Chest',
          type: 'Barbell',
          order: 1,
          sets: [
            { id: 'a', setNumber: 1, weight: 80, reps: 5 },
            { id: 'b', setNumber: 2, weight: 85, reps: 4 },
          ],
        },
      ],
    }

    const existingRecords = [
      {
        id: 'pr-1',
        userId: 'user-1',
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
        weight: 80,
        reps: 5,
        workoutId: 'old-workout',
        achievedAt: '2026-09-20T00:00:00.000Z',
      },
    ]

    const result = detectPersonalRecords(workout, existingRecords)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      exerciseId: 'bench-press',
      weight: 85,
      reps: 4,
    })
  })
})

describe('getExerciseProgressForExercise', () => {
  it('uses the highest weight per workout for a selected exercise', () => {
    const workouts = [
      {
        id: 'w-1',
        name: 'Workout 1',
        startedAt: '2026-09-01T08:00:00.000Z',
        completedAt: '2026-09-01T09:00:00.000Z',
        createdAt: '2026-09-01T09:00:00.000Z',
        exercises: [
          {
            id: 'e-1',
            exerciseId: 'bench-press',
            name: 'Bench Press',
            muscleGroup: 'Chest',
            type: 'Barbell',
            order: 1,
            sets: [
              { id: 's-1', setNumber: 1, weight: 60, reps: 10 },
              { id: 's-2', setNumber: 2, weight: 70, reps: 8 },
            ],
          },
        ],
      },
      {
        id: 'w-2',
        name: 'Workout 2',
        startedAt: '2026-09-15T08:00:00.000Z',
        completedAt: '2026-09-15T09:00:00.000Z',
        createdAt: '2026-09-15T09:00:00.000Z',
        exercises: [
          {
            id: 'e-2',
            exerciseId: 'bench-press',
            name: 'Bench Press',
            muscleGroup: 'Chest',
            type: 'Barbell',
            order: 1,
            sets: [
              { id: 's-3', setNumber: 1, weight: 75, reps: 6 },
              { id: 's-4', setNumber: 2, weight: 80, reps: 5 },
            ],
          },
        ],
      },
    ]

    const result = getExerciseProgressForExercise('bench-press', workouts)

    expect(result).toEqual([
      { date: '1 sep', weight: 70 },
      { date: '15 sep', weight: 80 },
    ])
  })
})

describe('getDashboardMetrics', () => {
  it('calculates weekly activity and training volume from completed workouts', () => {
    const workouts = [
      {
        id: 'w-1',
        name: 'Workout 1',
        startedAt: '2026-09-01T08:00:00.000Z',
        completedAt: '2026-09-01T09:00:00.000Z',
        createdAt: '2026-09-01T09:00:00.000Z',
        exercises: [
          {
            id: 'e-1',
            exerciseId: 'bench-press',
            name: 'Bench Press',
            muscleGroup: 'Chest',
            type: 'Barbell',
            order: 1,
            sets: [
              { id: 's-1', setNumber: 1, weight: 60, reps: 5 },
              { id: 's-2', setNumber: 2, weight: 70, reps: 5 },
            ],
          },
        ],
      },
      {
        id: 'w-2',
        name: 'Workout 2',
        startedAt: '2026-09-15T08:00:00.000Z',
        completedAt: '2026-09-15T09:00:00.000Z',
        createdAt: '2026-09-15T09:00:00.000Z',
        exercises: [
          {
            id: 'e-2',
            exerciseId: 'squat',
            name: 'Squat',
            muscleGroup: 'Legs',
            type: 'Barbell',
            order: 1,
            sets: [
              { id: 's-3', setNumber: 1, weight: 80, reps: 5 },
              { id: 's-4', setNumber: 2, weight: 90, reps: 5 },
            ],
          },
        ],
      },
    ]

    const metrics = getDashboardMetrics(workouts)

    expect(metrics.workoutsThisWeek).toBe(0)
    expect(metrics.averageVolume).toBe(750)
    expect(metrics.consistency).toBeGreaterThanOrEqual(0)
  })
})

describe('getWeeklyVolumeTrend', () => {
  it('aggregates the workout volume by workout date', () => {
    const workouts = [
      {
        id: 'w-1',
        name: 'Workout 1',
        startedAt: '2026-09-01T08:00:00.000Z',
        completedAt: '2026-09-01T09:00:00.000Z',
        createdAt: '2026-09-01T09:00:00.000Z',
        exercises: [
          {
            id: 'e-1',
            exerciseId: 'bench-press',
            name: 'Bench Press',
            muscleGroup: 'Chest',
            type: 'Barbell',
            order: 1,
            sets: [
              { id: 's-1', setNumber: 1, weight: 60, reps: 5 },
              { id: 's-2', setNumber: 2, weight: 70, reps: 5 },
            ],
          },
        ],
      },
      {
        id: 'w-2',
        name: 'Workout 2',
        startedAt: '2026-09-15T08:00:00.000Z',
        completedAt: '2026-09-15T09:00:00.000Z',
        createdAt: '2026-09-15T09:00:00.000Z',
        exercises: [
          {
            id: 'e-2',
            exerciseId: 'squat',
            name: 'Squat',
            muscleGroup: 'Legs',
            type: 'Barbell',
            order: 1,
            sets: [
              { id: 's-3', setNumber: 1, weight: 80, reps: 5 },
            ],
          },
        ],
      },
    ]

    const trend = getWeeklyVolumeTrend(workouts)

    expect(trend).toEqual([
      { label: '1 sep', volume: 650 },
      { label: '15 sep', volume: 400 },
    ])
  })
})

describe('getTopExercisesByVolume', () => {
  it('ranks the exercises by training volume', () => {
    const workouts = [
      {
        id: 'w-1',
        name: 'Workout 1',
        startedAt: '2026-09-01T08:00:00.000Z',
        completedAt: '2026-09-01T09:00:00.000Z',
        createdAt: '2026-09-01T09:00:00.000Z',
        exercises: [
          {
            id: 'e-1',
            exerciseId: 'bench-press',
            name: 'Bench Press',
            muscleGroup: 'Chest',
            type: 'Barbell',
            order: 1,
            sets: [
              { id: 's-1', setNumber: 1, weight: 60, reps: 5 },
              { id: 's-2', setNumber: 2, weight: 70, reps: 5 },
            ],
          },
          {
            id: 'e-2',
            exerciseId: 'squat',
            name: 'Squat',
            muscleGroup: 'Legs',
            type: 'Barbell',
            order: 2,
            sets: [
              { id: 's-3', setNumber: 1, weight: 80, reps: 5 },
            ],
          },
        ],
      },
    ]

    expect(getTopExercisesByVolume(workouts)).toEqual([
      { exerciseId: 'bench-press', name: 'Bench Press', volume: 650 },
      { exerciseId: 'squat', name: 'Squat', volume: 400 },
    ])
  })
})
