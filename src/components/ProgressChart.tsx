import type { ExerciseProgressDatum } from '../types'

interface ProgressChartProps {
  data: ExerciseProgressDatum[]
}

export function ProgressChart({ data }: ProgressChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
        Nog geen trainingsdata beschikbaar voor deze oefening.
      </div>
    )
  }

  const width = 520
  const height = 220
  const padding = 28
  const maxWeight = Math.max(...data.map((point) => point.weight), 0) + 5
  const minWeight = Math.min(...data.map((point) => point.weight), 0) - 5

  const points = data.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / (data.length - 1 || 1)
    const y =
      height -
      (((point.weight - minWeight) / (maxWeight - minWeight || 1)) * (height - padding * 2)) -
      padding

    return { ...point, x, y }
  })

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Gewichtsontwikkeling">
        <defs>
          <linearGradient id="progress-line" x1="0" x2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((index) => {
          const y = padding + index * ((height - padding * 2) / 3)
          return <line key={y} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#334155" strokeDasharray="4 8" />
        })}

        <path d={path} fill="none" stroke="url(#progress-line)" strokeWidth="4" strokeLinecap="round" />

        {points.map((point) => (
          <g key={`${point.date}-${point.weight}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="#a7f3d0" stroke="#022c22" strokeWidth="2" />
            <text x={point.x} y={height - 8} textAnchor="middle" fill="#94a3b8" fontSize="12">
              {point.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
