import { motion } from 'framer-motion'
import { PriceChange } from '@/components/ui/PriceChange'
import type { PricesLatest } from '@/types/data'

interface MarketSnapshotProps {
  reference: PricesLatest['reference']
}

export function MarketSnapshot({ reference }: MarketSnapshotProps) {
  const items = [
    { label: 'WTI Crude', value: `$${reference.wti.price?.toFixed(2)}`, change: reference.wti.change_pct },
    { label: 'OPEC Basket', value: `$${reference.opec_basket.price?.toFixed(2)}`, change: reference.opec_basket.change_pct },
    { label: 'USD/RUB', value: reference.usd_rub.rate?.toFixed(2) ?? '—', change: reference.usd_rub.change_pct },
  ]

  return (
    <motion.div
      className="grid grid-cols-3 gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-warm-card rounded-lg p-3 card-shadow text-center"
        >
          <p className="text-[10px] font-medium text-warm-text-secondary uppercase tracking-wider mb-1">
            {item.label}
          </p>
          <p className="text-base font-mono font-semibold tabular-nums text-warm-text">
            {item.value}
          </p>
          <PriceChange changePct={item.change} showIcon={false} className="text-xs justify-center mt-0.5" />
        </div>
      ))}
    </motion.div>
  )
}
