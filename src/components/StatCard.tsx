import type { MetricCard } from '../types'

interface StatCardProps {
  card: MetricCard
}

export function StatCard({ card }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
      <p className="text-sm text-slate-400">{card.label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <p className="text-3xl font-semibold text-white">{card.value}</p>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            card.trend === 'up'
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          {card.change}
        </span>
      </div>
    </div>
  )
}
