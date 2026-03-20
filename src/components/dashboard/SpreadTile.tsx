import { motion } from 'framer-motion'
import { Sparkline } from '@/components/ui/Sparkline'
import type { SpreadData } from '@/types/data'

interface SpreadTileProps {
  data: SpreadData
  index: number
}

export function SpreadTile({ data, index }: SpreadTileProps) {
  const color = data.direction === 'narrowing' ? '#166534' : '#b91c1c'
  const directionLabel = data.direction === 'narrowing'
    ? 'Narrowing'
    : data.direction === 'widening'
      ? 'Widening'
      : 'Stable'

  return (
    <motion.div
      className="bg-warm-card rounded-xl p-4 card-shadow border border-dashed border-warm-border transition-shadow hover:card-shadow-lg"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-medium text-warm-text-secondary uppercase tracking-wide italic">
            Urals–Brent Spread
          </p>
          <p className="text-[10px] text-warm-text-secondary italic mt-0.5">Geopolitical signal</p>
        </div>
        <Sparkline data={data.trend_30d} color={color} width={64} height={24} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-mono font-semibold tabular-nums text-warm-text">
          {data.value < 0 ? '−' : '+'}${Math.abs(data.value).toFixed(2)}
        </span>
        <span className="text-xs text-warm-text-secondary">
          {data.value < 0 ? 'discount' : 'premium'}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium" style={{ color }}>
          {directionLabel}
        </span>
      </div>
    </motion.div>
  )
}
