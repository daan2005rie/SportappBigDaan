import type {
  CompletedWorkout,
  CompletedWorkoutExercise,
  CompletedWorkoutSet,
  ExerciseProgressDatum,
  PersonalRecord,
  WorkoutDraft,
  WorkoutExerciseItem,
  WorkoutPreset,
} from '../types'

const COMPLETED_WORKOUTS_KEY = 'bigdaan.completed-workouts.v1'
const DRAFT_WORKOUT_KEY = 'bigdaan.workout-draft.v2'
const PERSONAL_RECORDS_KEY = 'bigdaan.personal-records.v1'

const createSeedWorkouts = (): CompletedWorkout[] => [
  {
    id: 'seed-borst-triceps',
    name: 'Borst & Triceps',
    startedAt: '2026-09-30T08:15:00.000Z',
    completedAt: '2026-09-30T09:10:00.000Z',
    createdAt: '2026-09-30T09:10:00.000Z',
    exercises: [
      {
        id: 'seed-ex-1',
        exerciseId: 'bench-press',
        name: 'Bench Press',
        muscleGroup: 'Chest',
        secondaryMuscleGroup: 'Triceps',
        type: 'Barbell',
        order: 1,
        sets: [
          { id: 'seed-set-1', setNumber: 1, weight: 60, reps: 10 },
          { id: 'seed-set-2', setNumber: 2, weight: 70, reps: 8 },
          { id: 'seed-set-3', setNumber: 3, weight: 75, reps: 6 },
        ],
      },
      {
        id: 'seed-ex-2',
        exerciseId: 'incline-bench-press',
        name: 'Incline Bench Press',
        muscleGroup: 'Chest',
        secondaryMuscleGroup: 'Shoulders',
        type: 'Barbell',
        order: 2,
        sets: [
          { id: 'seed-set-3', setNumber: 1, weight: 45, reps: 10 },
          { id: 'seed-set-4', setNumber: 2, weight: 50, reps: 9 },
          { id: 'seed-set-5', setNumber: 3, weight: 55, reps: 8 },
        ],
      },
    ],
  },
  {
    id: 'seed-benen',
    name: 'Benen',
    startedAt: '2026-09-28T17:00:00.000Z',
    completedAt: '2026-09-28T18:20:00.000Z',
    createdAt: '2026-09-28T18:20:00.000Z',
    exercises: [
      {
        id: 'seed-ex-3',
        exerciseId: 'squat',
        name: 'Squat',
        muscleGroup: 'Legs',
        secondaryMuscleGroup: 'Glutes',
        type: 'Barbell',
        order: 1,
        sets: [
          { id: 'seed-set-6', setNumber: 1, weight: 90, reps: 6 },
          { id: 'seed-set-7', setNumber: 2, weight: 100, reps: 5 },
        ],
      },
    ],
  },
]

export function loadCompletedWorkouts(): CompletedWorkout[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(COMPLETED_WORKOUTS_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as CompletedWorkout[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadPersonalRecords(): PersonalRecord[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(PERSONAL_RECORDS_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as PersonalRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePersonalRecords(records: PersonalRecord[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PERSONAL_RECORDS_KEY, JSON.stringify(records))
}

export function detectPersonalRecords(
  workout: CompletedWorkout,
  existingRecords: PersonalRecord[] = loadPersonalRecords(),
): PersonalRecord[] {
  const newRecords: PersonalRecord[] = []

  for (const exercise of workout.exercises) {
    const bestSet = exercise.sets.reduce(
      (best, current) => {
        if (current.weight > best.weight) {
          return current
        }

        if (current.weight === best.weight && current.reps > best.reps) {
          return current
        }

        return best
      },
      exercise.sets[0] ?? { id: '', setNumber: 0, weight: 0, reps: 0 },
    )

    if (!exercise.sets.length || bestSet.weight <= 0) {
      continue
    }

    const previousRecord = existingRecords.find((record) => record.exerciseId === exercise.exerciseId)

    if (previousRecord && bestSet.weight <= previousRecord.weight) {
      continue
    }

    newRecords.push({
      id: crypto.randomUUID(),
      userId: 'user-1',
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      weight: bestSet.weight,
      reps: bestSet.reps,
      workoutId: workout.id,
      achievedAt: workout.completedAt,
    })
  }

  return newRecords
}

export function applyPersonalRecords(workout: CompletedWorkout) {
  const currentRecords = loadPersonalRecords()
  const newRecords = detectPersonalRecords(workout, currentRecords)

  if (!newRecords.length) {
    return { newRecords: [] as PersonalRecord[], records: currentRecords }
  }

  const mergedRecords = [
    ...currentRecords.filter((record) => !newRecords.some((newRecord) => newRecord.exerciseId === record.exerciseId)),
    ...newRecords,
  ].sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())

  savePersonalRecords(mergedRecords)

  return { newRecords, records: mergedRecords }
}

export function saveCompletedWorkout(workout: CompletedWorkout) {
  const current = loadCompletedWorkouts()
  const next = [workout, ...current].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  )

  window.localStorage.setItem(COMPLETED_WORKOUTS_KEY, JSON.stringify(next))

  return applyPersonalRecords(workout)
}

export function loadWorkoutSessionDraft(): WorkoutDraft | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(DRAFT_WORKOUT_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as WorkoutDraft | WorkoutExerciseItem[]
    if (Array.isArray(parsed)) {
      return parsed.length
        ? { id: crypto.randomUUID(), name: 'Workout', startedAt: new Date().toISOString(), exercises: parsed }
        : null
    }

    return parsed && Array.isArray(parsed.exercises)
      ? { ...parsed, id: parsed.id || crypto.randomUUID() }
      : null
  } catch {
    return null
  }
}

export function loadWorkoutDraft(): WorkoutExerciseItem[] {
  return loadWorkoutSessionDraft()?.exercises ?? []
}

export function saveWorkoutSessionDraft(draft: WorkoutDraft | null) {
  if (typeof window === 'undefined') return
  if (!draft) {
    window.localStorage.removeItem(DRAFT_WORKOUT_KEY)
    return
  }
  window.localStorage.setItem(DRAFT_WORKOUT_KEY, JSON.stringify(draft))
}

export function saveWorkoutDraft(exercises: WorkoutExerciseItem[]) {
  if (!exercises.length) {
    saveWorkoutSessionDraft(null)
    return
  }

  const currentDraft = loadWorkoutSessionDraft()
  saveWorkoutSessionDraft({
    id: currentDraft?.id ?? crypto.randomUUID(),
    name: currentDraft?.name ?? 'Workout',
    startedAt: currentDraft?.startedAt ?? new Date().toISOString(),
    ...(currentDraft?.presetId ? { presetId: currentDraft.presetId } : {}),
    exercises,
  })
}

export function clearWorkoutDraft() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DRAFT_WORKOUT_KEY)
}

export function readLegacyFitnessData() {
  if (typeof window === 'undefined') {
    return { workouts: [] as CompletedWorkout[], personalRecords: [] as PersonalRecord[], draft: null as WorkoutDraft | null }
  }

  const parseArray = <T,>(key: string): T[] => {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) throw new Error(`Lokale data in ${key} hebben een ongeldig formaat.`)
    return parsed as T[]
  }

  const draftKey = window.localStorage.getItem(DRAFT_WORKOUT_KEY) !== null
    ? DRAFT_WORKOUT_KEY
    : 'bigdaan.workout-draft.v1'
  const draftRaw = window.localStorage.getItem(draftKey)
  let draft: WorkoutDraft | null = null
  if (draftRaw) {
    const parsed = JSON.parse(draftRaw) as unknown
    if (Array.isArray(parsed)) {
      if (parsed.length) {
        draft = { id: crypto.randomUUID(), name: 'Workout', startedAt: new Date().toISOString(), exercises: parsed as WorkoutExerciseItem[] }
      }
    } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as WorkoutDraft).exercises)) {
      const session = parsed as WorkoutDraft
      draft = { ...session, id: session.id || crypto.randomUUID() }
    } else {
      throw new Error(`Lokaal workoutconcept in ${draftKey} heeft een ongeldig formaat.`)
    }
  }

  return {
    workouts: parseArray<CompletedWorkout>(COMPLETED_WORKOUTS_KEY),
    personalRecords: parseArray<PersonalRecord>(PERSONAL_RECORDS_KEY),
    draft,
    workoutPresets: parseArray<WorkoutPreset>('bigdaan.workout-presets.v1'),
  }
}

export function clearLegacyFitnessData() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(COMPLETED_WORKOUTS_KEY)
  window.localStorage.removeItem(DRAFT_WORKOUT_KEY)
  window.localStorage.removeItem('bigdaan.workout-draft.v1')
  window.localStorage.removeItem(PERSONAL_RECORDS_KEY)
  window.localStorage.removeItem('bigdaan.workout-presets.v1')
}

export function validateWorkout(exercises: WorkoutExerciseItem[]) {
  if (!exercises.length) {
    return 'Voeg minimaal één oefening toe aan de workout.'
  }

  for (const exercise of exercises) {
    if (!exercise.sets.length) {
      return `Voeg ten minste één set toe voor ${exercise.name}.`
    }

    for (const set of exercise.sets) {
      const weightValue = Number(set.weight)
      const repsValue = Number(set.reps)

      if (Number.isNaN(weightValue) || weightValue < 0) {
        return `Controleer het gewicht bij ${exercise.name}.`
      }

      if (Number.isNaN(repsValue) || repsValue <= 0 || !Number.isInteger(repsValue)) {
        return `Controleer het aantal herhalingen bij ${exercise.name}.`
      }
    }
  }

  return null
}

export function toCompletedWorkout(
  name: string,
  exercises: WorkoutExerciseItem[],
  startedAt: string,
  presetId?: string,
  workoutId?: string,
): CompletedWorkout {
  const completedAt = new Date().toISOString()

  const nextExercises: CompletedWorkoutExercise[] = exercises.map((exercise, index) => ({
    id: `${exercise.id}-${index}`,
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    secondaryMuscleGroup: exercise.secondaryMuscleGroup,
    type: exercise.type,
    order: index + 1,
    sets: exercise.sets.map((set, setIndex) => ({
      id: `${set.id}-${setIndex}`,
      setNumber: setIndex + 1,
      weight: Number(set.weight),
      reps: Number(set.reps),
    })),
  }))

  return {
    id: workoutId ?? crypto.randomUUID(),
    ...(presetId ? { presetId } : {}),
    name,
    startedAt,
    completedAt,
    createdAt: completedAt,
    exercises: nextExercises,
  }
}

export function getExercisePerformance(exerciseId: string) {
  const previousExercise = loadCompletedWorkouts()
    .slice()
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .map((workout) => ({
      workout,
      exercise: workout.exercises.find((entry) => entry.exerciseId === exerciseId),
    }))
    .find((entry) => entry.exercise?.sets.length)

  const previousSet = previousExercise?.exercise?.sets.reduce((best, set) => {
    if (set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) {
      return set
    }
    return best
  })

  const personalRecord = loadPersonalRecords()
    .filter((record) => record.exerciseId === exerciseId)
    .sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0]

  return {
    previousPerformance: previousSet ? `Vorige keer: ${previousSet.weight} kg × ${previousSet.reps}` : undefined,
    personalRecord: personalRecord ? `PR: ${personalRecord.weight} kg × ${personalRecord.reps}` : undefined,
  }
}

export function getWorkoutSummary(workout: CompletedWorkout) {
  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  return {
    totalSets,
    totalExercises: workout.exercises.length,
  }
}

export function formatWorkoutDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function getLastWorkoutRecord() {
  const workouts = loadCompletedWorkouts()
  return workouts[0] ?? null
}

export function findWorkoutById(id: string) {
  return loadCompletedWorkouts().find((workout) => workout.id === id) ?? null
}

export function getWorkoutSetTotal(workout: CompletedWorkout) {
  return workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
}

export function getWorkoutExercisePreview(workout: CompletedWorkout) {
  return workout.exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    maxWeight: Math.max(...exercise.sets.map((set) => set.weight), 0),
    totalReps: exercise.sets.reduce((sum, set) => sum + set.reps, 0),
  }))
}

export function getWorkoutStats(workout: CompletedWorkout) {
  return {
    totalSets: getWorkoutSetTotal(workout),
    totalExercises: workout.exercises.length,
    maxWeight: Math.max(
      0,
      ...workout.exercises.flatMap((exercise) => exercise.sets.map((set) => set.weight)),
    ),
  }
}

export function getSeedCompletedWorkoutCount() {
  return createSeedWorkouts().length
}

export function getRecentPersonalRecords(limit = 3): PersonalRecord[] {
  return loadPersonalRecords()
    .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
    .slice(0, limit)
}

export function getDashboardMetrics(workouts: CompletedWorkout[] = loadCompletedWorkouts()) {
  const currentTime = Date.now()
  const weekInMs = 7 * 24 * 60 * 60 * 1000
  const monthInMs = 30 * 24 * 60 * 60 * 1000

  const workoutsThisWeek = workouts.filter((workout) => {
    const workoutTime = new Date(workout.completedAt).getTime()
    return currentTime - workoutTime <= weekInMs
  }).length

  const totalVolume = workouts.reduce((sum, workout) => {
    return (
      sum +
      workout.exercises.reduce((exerciseSum, exercise) => {
        return (
          exerciseSum +
          exercise.sets.reduce((setSum, set) => {
            return setSum + set.weight * set.reps
          }, 0)
        )
      }, 0)
    )
  }, 0)

  const averageVolume = workouts.length ? Math.round(totalVolume / workouts.length) : 0

  const recentWorkoutDays = new Set(
    workouts
      .filter((workout) => currentTime - new Date(workout.completedAt).getTime() <= monthInMs)
      .map((workout) => new Date(workout.completedAt).toISOString().slice(0, 10)),
  )

  const consistency = recentWorkoutDays.size ? (recentWorkoutDays.size / 30) * 100 : 0

  return {
    workoutsThisWeek,
    averageVolume,
    consistency,
  }
}

export function getWeeklyVolumeTrend(workouts: CompletedWorkout[] = loadCompletedWorkouts()) {
  return workouts
    .slice()
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .map((workout) => ({
      label: new Date(workout.completedAt).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
      }),
      volume: workout.exercises.reduce((exerciseSum, exercise) => {
        return (
          exerciseSum +
          exercise.sets.reduce((setSum, set) => {
            return setSum + set.weight * set.reps
          }, 0)
        )
      }, 0),
    }))
}

export function getTopExercisesByVolume(workouts: CompletedWorkout[] = loadCompletedWorkouts()) {
  const volumeMap = new Map<string, { exerciseId: string; name: string; volume: number }>()

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const current = volumeMap.get(exercise.exerciseId) ?? {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        volume: 0,
      }

      const exerciseVolume = exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0)
      current.volume += exerciseVolume
      volumeMap.set(exercise.exerciseId, current)
    }
  }

  return [...volumeMap.values()].sort((a, b) => b.volume - a.volume)
}

export function getExerciseProgressForExercise(
  exerciseId: string,
  workouts: CompletedWorkout[] = loadCompletedWorkouts(),
): ExerciseProgressDatum[] {
  const points = workouts
    .map((workout) => {
      const exercise = workout.exercises.find((entry) => entry.exerciseId === exerciseId)

      if (!exercise || !exercise.sets.length) {
        return null
      }

      const timestamp = new Date(workout.completedAt).getTime()
      const bestWeight = exercise.sets.reduce((maxWeight, set) => Math.max(maxWeight, set.weight), 0)

      if (bestWeight <= 0) {
        return null
      }

      return {
        date: new Date(workout.completedAt).toLocaleDateString('nl-NL', {
          day: 'numeric',
          month: 'short',
        }),
        weight: bestWeight,
        timestamp,
      }
    })
    .filter((point): point is ExerciseProgressDatum & { timestamp: number } => Boolean(point))
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ timestamp, ...point }) => point)

  return points
}

export function getPersonalRecordsForExercise(exerciseId: string): PersonalRecord[] {
  return loadPersonalRecords()
    .filter((record) => record.exerciseId === exerciseId)
    .sort((a, b) => b.weight - a.weight)
}

export type { CompletedWorkoutSet }
