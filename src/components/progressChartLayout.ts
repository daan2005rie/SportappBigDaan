import type { ExerciseProgressDatum } from '../types'

export function getProgressChartLayout(data: ExerciseProgressDatum[], width: number) {
  const sorted = data.filter((point) => Number.isFinite(Date.parse(point.date)) && Number.isFinite(point.weight) && point.weight >= 0)
    .toSorted((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const left = 58
  const right = width - 30
  const top = 28
  const bottom = 214
  const weights = sorted.map((point) => point.weight)
  const min = weights.length ? Math.min(...weights) : 0
  const max = Math.max(...weights, 0)
  const range = Math.max(max - min, 5)
  const rawStep = range * 1.4 / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((value) => value * magnitude).find((value) => value >= rawStep) ?? magnitude * 10
  const low = Math.max(0, Math.floor((min - range * 0.2) / step) * step)
  const high = Math.max(low + step * 4, Math.ceil((max + range * 0.2) / step) * step)
  const firstTime = sorted.length ? Date.parse(sorted[0].date) : 0
  const lastTime = sorted.length ? Date.parse(sorted[sorted.length - 1].date) : 0
  const points = sorted.map((point) => ({
    ...point,
    x: firstTime === lastTime ? (left + right) / 2 : left + (Date.parse(point.date) - firstTime) / (lastTime - firstTime) * (right - left),
    y: bottom - (point.weight - low) / (high - low) * (bottom - top),
  }))
  // Select labels by their actual position, keeping them apart on narrow screens.
  const spacedLabels = points.reduce<typeof points>((result, point, index) => {
    const previous = result.at(-1)
    const lastPoint = points.at(-1)!
    if (!previous || (point.x - previous.x >= 80 &&
      (index === points.length - 1 || lastPoint.x - point.x >= 80))) result.push(point)
    return result
  }, [])
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => {
    const value = low + index * step
    return { value, y: bottom - (value - low) / (high - low) * (bottom - top) }
  })
  return { points, labels: spacedLabels, ticks, left, right, top, bottom }
}
