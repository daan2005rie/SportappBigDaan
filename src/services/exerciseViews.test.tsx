import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./database', () => ({ supabase: {} }))

import { BottomNav } from '../components/BottomNav'
import { PersonalExerciseEditor } from '../components/PersonalExerciseEditor'
import { ExercisesPage } from '../pages/ExercisesPage'

function render(view: React.ReactNode) {
  return renderToStaticMarkup(<MemoryRouter>{view}</MemoryRouter>)
}

describe('exercise views', () => {
  it('renders the standard catalog, search field and add action', () => {
    const html = render(<ExercisesPage />)
    expect(html).toContain('Zoek oefeningen op naam')
    expect(html).toContain('Oefening toevoegen')
    expect((html.match(/href="\/exercises\//g) ?? []).length).toBe(220)
    expect(html).toContain('Mijn oefeningen')
  })

  it('fills the personal exercise editor with saved metadata', () => {
    const html = render(<PersonalExerciseEditor onClose={() => {}} onSave={async () => {}} exercise={{
      id: 'personal', userId: 'owner', name: 'Mijn cable press', description: 'Rustig uitvoeren.',
      archivedAt: null, muscleGroup: 'Borst', primaryMuscleGroups: ['Borst'], secondaryMuscles: ['Triceps'],
      type: 'Kabel', movementType: 'Compound',
    }} />)
    expect(html).toContain('Oefening bewerken')
    expect(html).toContain('Mijn cable press')
    expect(html).toContain('Rustig uitvoeren.')
    expect((html.match(/checked=""/g) ?? []).length).toBe(2)
    expect(html).toContain('value="Kabel" selected=""')
  })

  it('renders all five mobile links in the required order and highlights exercise details', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/exercises/9']}><BottomNav /></MemoryRouter>)
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    expect(links).toEqual(['/', '/workout', '/exercises', '/workouts', '/progress'])
    expect(html).toMatch(/aria-current="page"[^>]*href="\/exercises"/)
  })
})
