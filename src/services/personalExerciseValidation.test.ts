import { describe, expect, it } from 'vitest'

import { validatePersonalExercise } from './supabaseFitnessStore'

const validInput = {
  name: 'Cable press variation',
  description: 'Gecontroleerde uitvoering.',
  primaryMuscleGroups: ['Borst'],
  secondaryMuscles: ['Triceps'],
  equipment: 'Kabel',
  movementType: 'Compound',
}

describe('validatePersonalExercise', () => {
  it('accepts valid data using existing muscle, equipment, and movement options', () => {
    expect(validatePersonalExercise(validInput)).toBeNull()
  })

  it('rejects a missing name or primary muscle group', () => {
    expect(validatePersonalExercise({ ...validInput, name: '  ' })).toContain('naam')
    expect(validatePersonalExercise({ ...validInput, primaryMuscleGroups: [] })).toContain('primaire spiergroep')
  })

  it('rejects unknown option values and duplicate or overlapping muscle groups', () => {
    expect(validatePersonalExercise({ ...validInput, primaryMuscleGroups: ['Unknown'] })).toContain('bestaande lijst')
    expect(validatePersonalExercise({ ...validInput, equipment: 'Unknown' })).toContain('materiaal')
    expect(validatePersonalExercise({ ...validInput, primaryMuscleGroups: ['Borst', 'Borst'] })).toContain('dubbel')
    expect(validatePersonalExercise({ ...validInput, secondaryMuscles: ['Borst'] })).toContain('tegelijk primair en secundair')
  })

  it('rejects oversized descriptions', () => {
    expect(validatePersonalExercise({ ...validInput, description: 'x'.repeat(2001) })).toContain('2000')
  })
})