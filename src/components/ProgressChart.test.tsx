import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ProgressChart } from './ProgressChart'
import { getProgressChartLayout } from './progressChartLayout'

const data = [
  { date: '2026-10-26T10:00:00Z', weight: 85 },
  { date: '2026-10-12T10:00:00Z', weight: 80 },
  { date: '2026-10-19T10:00:00Z', weight: 82.5 },
]

describe('progress chart', () => {
  it('connects points in chronological order without changing the supplied data', () => {
    const { points } = getProgressChartLayout(data, 520)
    expect(points.map((point) => point.weight)).toEqual([80, 82.5, 85])
    expect(points[0].x).toBeLessThan(points[1].x)
    expect(points[1].x).toBeLessThan(points[2].x)
    expect(data[0].weight).toBe(85)
    const html = renderToStaticMarkup(<ProgressChart data={data} />)
    expect(html).toMatch(/d="M [^"]+L [^"]+L /)
    expect(html).toContain('26 oktober 2026: 85 kg')
    expect(html).toContain('Gewicht (kg)')
    expect(html).toContain('12 okt')
    expect((html.match(/role="button"/g) ?? []).length).toBe(3)
  })

  it('centres a single point and provides a usable scale for equal or zero weights', () => {
    for (const weight of [0, 85]) {
      const layout = getProgressChartLayout([{ date: data[0].date, weight }], 280)
      expect(layout.points[0].x).toBe((layout.left + layout.right) / 2)
      expect(Number.isFinite(layout.points[0].y)).toBe(true)
      expect(layout.ticks[0].value).toBeGreaterThanOrEqual(0)
      expect(layout.ticks.at(-1)!.value).toBeGreaterThan(weight)
    }
  })

  it('uses time spacing across years and makes decreases visible', () => {
    const { points } = getProgressChartLayout([
      { date: '2027-01-04T10:00:00Z', weight: 75 },
      { date: '2026-12-31T10:00:00Z', weight: 85 },
      { date: '2027-01-01T10:00:00Z', weight: 80 },
    ], 520)
    expect(points[1].x - points[0].x).toBeCloseTo((points[2].x - points[0].x) / 4)
    expect(points[0].y).toBeLessThan(points[2].y)
  })

  it('keeps labels apart at mobile widths, including dense data', () => {
    const dense = Array.from({ length: 40 }, (_, index) => ({ date: new Date(2026, 9, index + 1).toISOString(), weight: 80 + index / 2 }))
    const { labels } = getProgressChartLayout(dense, 260)
    for (let index = 1; index < labels.length; index++) expect(labels[index].x - labels[index - 1].x).toBeGreaterThanOrEqual(80)
  })

  it('shows the empty state and excludes invalid values', () => {
    const bad = [{ date: 'bad date', weight: 20 }, { date: data[0].date, weight: NaN }]
    expect(getProgressChartLayout(bad, 280).points).toEqual([])
    expect(renderToStaticMarkup(<ProgressChart data={bad} />)).toContain('Nog geen trainingsdata')
  })
})
