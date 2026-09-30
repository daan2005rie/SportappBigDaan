import {
  BarChart3,
  Dumbbell,
  Flame,
  Home,
  ListChecks,
  Trophy,
} from 'lucide-react'

import { exerciseCatalog } from './exercises'
import type { ExerciseOption, MetricCard, NavigationItem, RecentRecord, WorkoutSummary } from '../types'

export const metricCards: MetricCard[] = [
  {
    id: 'workouts-this-week',
    label: 'Workouts deze week',
    value: '5',
    change: '+2 vs. vorige week',
    trend: 'up',
  },
  {
    id: 'average-volume',
    label: 'Gemiddeld volume',
    value: '1.440 kg',
    change: '+140 kg',
    trend: 'up',
  },
  {
    id: 'consistency',
    label: 'Consistency',
    value: '78%',
    change: '3 dagen achter elkaar',
    trend: 'neutral',
  },
]

export const recentRecords: RecentRecord[] = [
  { id: 'bench', name: 'Bench Press', value: '80 kg × 8', detail: 'Nieuw record' },
  { id: 'squat', name: 'Squat', value: '100 kg × 5', detail: 'Sterk weekend' },
  { id: 'pull', name: 'Lat Pulldown', value: '70 kg × 10', detail: 'Stabiele kracht' },
]

export const recentWorkout: WorkoutSummary = {
  id: 'workout-2026-09-30',
  name: 'Borst & Triceps',
  date: '30 september 2026',
  exercises: 3,
  sets: 10,
  accent: 'from-emerald-500 to-cyan-500',
}

export const workspaceHistory: WorkoutSummary[] = [
  { id: 'w-30', name: 'Borst & Triceps', date: '30 september 2026', exercises: 3, sets: 10, accent: 'from-emerald-500 to-cyan-500' },
  { id: 'w-28', name: 'Benen', date: '28 september 2026', exercises: 5, sets: 16, accent: 'from-violet-500 to-indigo-500' },
  { id: 'w-25', name: 'Rug & Biceps', date: '25 september 2026', exercises: 4, sets: 12, accent: 'from-amber-500 to-orange-500' },
]

export const navigationItems: NavigationItem[] = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'workout', label: 'Workout', href: '/workout', icon: Dumbbell },
  { key: 'workouts', label: 'Mijn workouts', href: '/workouts', icon: ListChecks },
  { key: 'progress', label: 'Progressie', href: '/progress', icon: BarChart3 },
]

export const exerciseOptions: ExerciseOption[] = exerciseCatalog.map((exercise) => ({
  id: exercise.id,
  name: exercise.name,
  muscleGroup: exercise.muscleGroup,
  type: exercise.type,
}))

export const exerciseProgress = [
  { date: '1 sep', weight: 70 },
  { date: '8 sep', weight: 72.5 },
  { date: '15 sep', weight: 75 },
  { date: '22 sep', weight: 77.5 },
  { date: '29 sep', weight: 80 },
]

export const quickStats = [
  { id: 'streak', label: 'Training streak', value: '5 dagen', icon: Flame },
  { id: 'pr', label: 'PR vorige week', value: '100 kg × 5', icon: Trophy },
]
