import type { Exercise } from '../types'

export const exerciseCatalog: Exercise[] = [
  {
    id: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    secondaryMuscleGroup: 'Triceps',
    type: 'Barbell',
  },
  {
    id: 'incline-bench-press',
    name: 'Incline Bench Press',
    muscleGroup: 'Chest',
    secondaryMuscleGroup: 'Shoulders',
    type: 'Barbell',
  },
  {
    id: 'squat',
    name: 'Squat',
    muscleGroup: 'Legs',
    secondaryMuscleGroup: 'Glutes',
    type: 'Barbell',
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    muscleGroup: 'Posterior Chain',
    secondaryMuscleGroup: 'Back',
    type: 'Barbell',
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    muscleGroup: 'Legs',
    secondaryMuscleGroup: 'Glutes',
    type: 'Machine',
  },
  {
    id: 'shoulder-press',
    name: 'Shoulder Press',
    muscleGroup: 'Shoulders',
    secondaryMuscleGroup: 'Triceps',
    type: 'Barbell',
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Back',
    secondaryMuscleGroup: 'Biceps',
    type: 'Machine',
  },
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    muscleGroup: 'Back',
    secondaryMuscleGroup: 'Biceps',
    type: 'Barbell',
  },
  {
    id: 'bicep-curl',
    name: 'Bicep Curl',
    muscleGroup: 'Biceps',
    secondaryMuscleGroup: 'Forearms',
    type: 'Dumbbell',
  },
  {
    id: 'tricep-pushdown',
    name: 'Tricep Pushdown',
    muscleGroup: 'Triceps',
    secondaryMuscleGroup: 'Chest',
    type: 'Cable',
  },
]
