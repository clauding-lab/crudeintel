import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, formatChangePct } from '@/lib/utils'

interface PriceChangeProps {
  changePct: number
  className?: string
  showIcon?: boolean
}

export function PriceChange({ changePct, className, showIcon = true }: PriceChangeProps) {
  const isPositive = changePct > 0
  const isNegative = changePct < 0
  const isFlat = changePct === 0

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  return (
    <motion.span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium font-mono tabular-nums',
        isPositive && 'text-positive',
        isNegative && 'text-negative',
        isFlat && 'text-warm-text-secondary',
        className
      )}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {showIcon && <Icon size={14} strokeWidth={2.5} />}
      {formatChangePct(changePct)}
    </motion.span>
  )
}
