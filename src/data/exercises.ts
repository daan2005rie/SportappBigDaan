import type { Exercise } from '../types'
import exerciseData from './exercises.json'

export const exerciseCatalog: Exercise[] = exerciseData.map((exercise) => ({
	id: String(exercise.id),
	name: exercise.name,
	muscleGroup: exercise.primaryMuscle,
	primaryMuscleGroups: [exercise.primaryMuscle],
	secondaryMuscleGroup: exercise.secondaryMuscles[0],
	secondaryMuscles: exercise.secondaryMuscles,
	type: exercise.equipment,
	movementType: exercise.type,
	description: exercise.description,
}))

export const muscleGroupOptions = [...new Set(exerciseCatalog.flatMap((exercise) => [
	exercise.muscleGroup,
	...(exercise.secondaryMuscles ?? []),
]))].sort((a, b) => a.localeCompare(b))

export const equipmentOptions = [...new Set(exerciseCatalog.map((exercise) => exercise.type))]
	.sort((a, b) => a.localeCompare(b))

export const movementTypeOptions = [...new Set(exerciseCatalog.flatMap((exercise) => (
	exercise.movementType ? [exercise.movementType] : []
)))].sort((a, b) => a.localeCompare(b))
