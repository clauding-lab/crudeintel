import { motion } from 'framer-motion'
import { PriceTile } from './PriceTile'
// SpreadTile removed — replaced with Urals India price tile
import { TopStories } from './TopStories'
import { MarketSnapshot } from './MarketSnapshot'
import { formatTimestamp } from '@/lib/utils'
import type { PricesLatest, NewsFeed } from '@/types/data'

interface DashboardTabProps {
  prices: PricesLatest
  news: NewsFeed
  onNavigateToNews: () => void
}

export function DashboardTab({ prices, news, onNavigateToNews }: DashboardTabProps) {
  return (
    <motion.div
      className="space-y-6 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Section: Prices */}
      <section>
        <h2 className="font-serif text-base font-semibold text-warm-text mb-3">Market Prices</h2>
        <div className="grid grid-cols-2 gap-3">
          <PriceTile
            label="Brent Crude"
            data={prices.prices.brent}
            index={0}
          />
          <PriceTile
            label="Urals Crude"
            data={prices.prices.urals}
            index={1}
            isDerived
            derivedNote="Est. | Brent minus discount"
          />
          <PriceTile
            label="Henry Hub Gas"
            data={prices.prices.henry_hub}
            index={2}
          />
          <PriceTile
            label="TTF Gas"
            data={prices.prices.ttf}
            index={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <PriceTile
            label="Urals (India) CIF"
            data={prices.prices.urals_india}
            index={4}
            isDerived
            derivedNote="Est. | Delivered to India west coast"
          />
          <PriceTile
            label="LNG Japan/Korea Marker"
            data={prices.prices.jkm}
            index={5}
            isDerived
            derivedNote="Asian Spot Market"
          />
        </div>
      </section>

      {/* Section: Top Stories */}
      <TopStories items={news.items} onViewAll={onNavigateToNews} />

      {/* Section: Market Snapshot */}
      <section>
        <h2 className="font-serif text-base font-semibold text-warm-text mb-3">Market Snapshot</h2>
        <MarketSnapshot reference={prices.reference} />
      </section>

      {/* Data source footer */}
      <motion.footer
        className="text-center pt-2 border-t border-warm-border"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-[10px] text-warm-text-secondary leading-relaxed">
          Prices via Yahoo Finance, Twelve Data & EIA · Updated hourly
        </p>
        <p className="text-[10px] text-warm-text-secondary">
          Last updated: {formatTimestamp(prices.updated_at)}
        </p>
      </motion.footer>
    </motion.div>
  )
}
