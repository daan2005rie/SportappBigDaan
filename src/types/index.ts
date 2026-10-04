import type { LucideIcon } from 'lucide-react'

export type NavigationKey = 'home' | 'workout' | 'workouts' | 'progress'

export interface NavigationItem {
  key: NavigationKey
  label: string
  href: string
  icon: LucideIcon
}

export interface MetricCard {
  id: string
  label: string
  value: string
  change: string
  trend: 'up' | 'neutral'
}

export interface RecentRecord {
  id: string
  name: string
  value: string
  detail: string
}

export interface WorkoutSummary {
  id: string
  name: string
  date: string
  exercises: number
  sets: number
  accent: string
}

export interface ExerciseProgressDatum {
  date: string
  weight: number
}

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  secondaryMuscleGroup?: string
  secondaryMuscles?: string[]
  type: string
  movementType?: string
  description?: string
}

export interface ExerciseOption {
  id: string
  name: string
  muscleGroup: string
  type: string
}

export interface WorkoutSetEntry {
  id: string
  weight: string
  reps: string
}

export interface WorkoutExerciseItem {
  id: string
  exerciseId: string
  name: string
  muscleGroup: string
  secondaryMuscleGroup?: string
  type: string
  sets: WorkoutSetEntry[]
  previousPerformance?: string
  personalRecord?: string
}

export interface PresetExercise {
  exerciseId: string
  order: number
  defaultSets: number
}

export interface WorkoutPreset {
  id: string
  userId: string
  name: string
  exercises: PresetExercise[]
  createdAt: string
  updatedAt: string
}

export interface WorkoutDraft {
  name: string
  startedAt: string
  exercises: WorkoutExerciseItem[]
  presetId?: string
}

export interface CompletedWorkoutSet {
  id: string
  setNumber: number
  weight: number
  reps: number
}

export interface CompletedWorkoutExercise {
  id: string
  exerciseId: string
  name: string
  muscleGroup: string
  secondaryMuscleGroup?: string
  type: string
  order: number
  sets: CompletedWorkoutSet[]
}

export interface CompletedWorkout {
  id: string
  presetId?: string
  name: string
  startedAt: string
  completedAt: string
  createdAt: string
  exercises: CompletedWorkoutExercise[]
}

export interface PersonalRecord {
  id: string
  userId: string
  exerciseId: string
  exerciseName: string
  weight: number
  reps: number
  workoutId: string
  achievedAt: string
}
