import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Sparkline } from '@/components/ui/Sparkline'
import { PriceChange } from '@/components/ui/PriceChange'
import type { PriceData } from '@/types/data'

interface PriceTileProps {
  label: string
  data: PriceData
  index: number
  isDerived?: boolean
  derivedNote?: string
}

export function PriceTile({ label, data, index, isDerived = false, derivedNote }: PriceTileProps) {
  const sparkColor = data.change_pct >= 0 ? '#b91c1c' : '#166534'

  return (
    <motion.div
      className={cn(
        'bg-warm-card rounded-xl p-4 card-shadow transition-shadow hover:card-shadow-lg',
        isDerived && 'border border-dashed border-warm-border'
      )}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className={cn(
            'text-xs font-medium text-warm-text-secondary uppercase tracking-wide',
            isDerived && 'italic'
          )}>
            {label}
          </p>
          {derivedNote && (
            <p className="text-[10px] text-warm-text-secondary italic mt-0.5">{derivedNote}</p>
          )}
        </div>
        <Sparkline data={data.sparkline_5d} color={sparkColor} width={64} height={24} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-mono font-semibold tabular-nums text-warm-text">
          {data.price.toFixed(2)}
        </span>
        <span className="text-xs text-warm-text-secondary">
          {data.currency}/{data.unit}
        </span>
      </div>
      <div className="mt-1.5">
        <PriceChange changePct={data.change_pct} />
      </div>
    </motion.div>
  )
}
