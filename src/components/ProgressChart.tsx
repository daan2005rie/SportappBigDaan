import { useEffect, useId, useRef, useState } from 'react'

import type { ExerciseProgressDatum } from '../types'
import { getProgressChartLayout } from './progressChartLayout'

interface ProgressChartProps {
  data: ExerciseProgressDatum[]
}

const shortDate = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })
const fullDate = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
const weightFormat = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 })

export function ProgressChart({ data }: ProgressChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(520)
  const [active, setActive] = useState<{ key: string; pinned: boolean } | null>(null)
  const id = useId().replaceAll(':', '')
  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const { points, labels, ticks, left, right, top, bottom } = getProgressChartLayout(data, width)
  const pointKey = (point: ExerciseProgressDatum, index: number) => `${point.date}-${point.weight}-${index}`
  const selected = points.find((point, index) => pointKey(point, index) === active?.key)

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
      <div ref={container} className="relative min-w-0" onKeyDown={(event) => {
        if (event.key === 'Escape') setActive(null)
      }} onPointerDown={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-progress-point]')) setActive(null)
      }}>
        {!points.length ? (
          <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
            Nog geen trainingsdata beschikbaar voor deze oefening.
          </p>
        ) : <>
          <svg viewBox={`0 0 ${width} 260`} className="h-[260px] w-full overflow-visible" role="group" aria-label="Gewichtsontwikkeling per workout">
            <defs>
              <linearGradient id={`${id}-line`} x1="0" x2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <text x={left} y={14} fill="#cbd5e1" fontSize="12">Gewicht (kg)</text>
            {ticks.map(({ value, y }) => <g key={value}>
              <line x1={left} x2={right} y1={y} y2={y} stroke="#334155" strokeDasharray="4 6" />
              <text x={left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="12">{weightFormat.format(value)}</text>
            </g>)}
            <line x1={left} x2={left} y1={top} y2={bottom} stroke="#64748b" />
            <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#64748b" />
            <path d={points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} fill="none" stroke={`url(#${id}-line)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {labels.map((point) => <text key={point.date} x={point.x} y={234} textAnchor="middle" fill="#94a3b8" fontSize="12">{shortDate.format(new Date(point.date)).replace('.', '')}</text>)}
            <text x={(left + right) / 2} y={255} textAnchor="middle" fill="#94a3b8" fontSize="12">Datum workout</text>
            {points.map((point, index) => {
              const key = pointKey(point, index)
              const show = () => setActive({ key, pinned: true })
              return <g key={key}>
                <circle cx={point.x} cy={point.y} r={selected === point ? 6 : 4} fill="#a7f3d0" stroke="#022c22" strokeWidth="2" pointerEvents="none" />
                <circle data-progress-point="" cx={point.x} cy={point.y} r="22" fill="transparent" role="button" tabIndex={0}
                  aria-label={`${fullDate.format(new Date(point.date))}: ${weightFormat.format(point.weight)} kg`}
                  aria-describedby={selected === point ? `${id}-tooltip` : undefined}
                  aria-pressed={selected === point && active?.pinned === true}
                  className="cursor-pointer outline-none focus:stroke-emerald-400 focus:stroke-2"
                  onPointerEnter={(event) => { if (event.pointerType !== 'touch') setActive({ key, pinned: false }) }}
                  onPointerLeave={() => setActive((current) => current?.pinned ? current : null)}
                  onFocus={() => setActive({ key, pinned: false })}
                  onBlur={() => setActive(null)} onClick={show}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show() } }} />
              </g>
            })}
          </svg>
          {selected ? <div id={`${id}-tooltip`} role="tooltip" className="pointer-events-none absolute top-6 z-10 w-[180px] rounded-xl border border-slate-600 bg-slate-950 p-3 text-center text-sm text-white shadow-lg"
            style={{ left: `clamp(0px, calc(${selected.x / width * 100}% - 90px), calc(100% - 180px))` }}>
            <p className="text-slate-300">{fullDate.format(new Date(selected.date))}</p>
            <p className="mt-1 font-semibold text-emerald-300">{weightFormat.format(selected.weight)} kg</p>
          </div> : null}
          <p className="mt-2 text-xs text-slate-400">Hoogste gewicht per workout. Tik op een punt voor de exacte datum en het gewicht.</p>
        </>}
      </div>
    </div>
  )
}
