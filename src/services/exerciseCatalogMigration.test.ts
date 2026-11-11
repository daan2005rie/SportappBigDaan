import { describe, expect, it } from 'vitest'
import exerciseData from '../data/exercises.json'

import migration from '../../supabase/migrations/20261018000000_private_personal_exercises.sql?raw'

describe('database catalog compatibility', () => {
  it('keeps the SQL allowlist identical to the real catalog IDs, without renumbering', () => {
    const definition = migration.slice(migration.indexOf('as $$ select coalesce'), migration.indexOf('false); $$;'))
    const sqlIds = [...definition.matchAll(/'([0-9]+)'/g)].map((match) => match[1])
    expect(sqlIds).toEqual(exerciseData.map((exercise) => String(exercise.id)))
  })

  it('keeps database muscle and equipment choices aligned with the actual catalog', () => {
    const trigger = migration.slice(migration.indexOf('function public.validate_personal_exercise()'))
    const arrays = [...trigger.matchAll(/any \(array\[(.*?)\]::text\[\]\)/g)]
    const values = arrays.slice(0, 2).map((array) => [...array[1].matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replaceAll("''", "'")))
    expect(values[0]).toEqual([...new Set(exerciseData.flatMap((exercise) => [exercise.primaryMuscle, ...exercise.secondaryMuscles]))].sort())
    expect(values[1]).toEqual([...new Set(exerciseData.map((exercise) => exercise.equipment))].sort())
  })
})
