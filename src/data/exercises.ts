import type { Exercise } from '../types'
import exerciseData from './exercises.json'

export const exerciseCatalog: Exercise[] = exerciseData.map((exercise) => ({
	id: String(exercise.id),
	name: exercise.name,
	muscleGroup: exercise.primaryMuscle,
	secondaryMuscleGroup: exercise.secondaryMuscles[0],
	secondaryMuscles: exercise.secondaryMuscles,
	type: exercise.equipment,
	movementType: exercise.type,
	description: exercise.description,
}))
