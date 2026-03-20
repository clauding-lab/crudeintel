import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, BookOpen } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { cn, timeAgo, formatTimestamp } from '@/lib/utils'
import type { NewsFeed, EnergyBrief, NewsCategory } from '@/types/data'

const categoryFilters: { id: NewsCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'opec_plus', label: 'OPEC+' },
  { id: 'geopolitics', label: 'Geopolitics' },
  { id: 'supply', label: 'Supply' },
  { id: 'demand', label: 'Demand' },
  { id: 'lng', label: 'LNG' },
  { id: 'russia_sanctions', label: 'Russia/Sanctions' },
]

interface NewsTabProps {
  news: NewsFeed
  brief: EnergyBrief
  onNavigateToBrief: () => void
}

export function NewsTab({ news, brief, onNavigateToBrief }: NewsTabProps) {
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('all')

  const filteredItems = activeCategory === 'all'
    ? news.items
    : news.items.filter((item) => item.category === activeCategory)

  return (
    <motion.div
      className="space-y-5 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Energy Desk Read hero card */}
      <motion.div
        className="bg-warm-card rounded-xl p-5 card-shadow border-l-[3px] border-crude-amber cursor-pointer hover:card-shadow-lg transition-shadow"
        onClick={onNavigateToBrief}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        whileHover={{ y: -2 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={16} className="text-crude-amber" />
          <span className="text-[10px] font-medium text-crude-amber uppercase tracking-widest">
            Energy Desk Read
          </span>
        </div>
        <h3 className="font-serif text-lg font-semibold text-warm-text mb-2 leading-snug">
          {brief.headline}
        </h3>
        <p className="text-sm text-warm-text-secondary line-clamp-3 leading-relaxed">
          {brief.sections.market_recap.split('\n')[0]}
        </p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-warm-border-light">
          <p className="text-[10px] text-warm-text-secondary italic">
            Curated by {brief.branding.author} · {brief.branding.ai_disclosure}
          </p>
          <span className="text-xs text-crude-amber font-medium">Read →</span>
        </div>
      </motion.div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {categoryFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveCategory(filter.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              activeCategory === filter.id
                ? 'bg-crude-amber text-white'
                : 'bg-warm-card text-warm-text-secondary hover:text-warm-text card-shadow'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* News feed */}
      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item, i) => (
            <motion.a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 bg-warm-card rounded-lg p-4 card-shadow hover:card-shadow-lg transition-shadow group block"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              layout
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-text leading-snug group-hover:text-crude-amber transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-warm-text-secondary mt-1.5 leading-relaxed line-clamp-2">
                  {item.ai_summary}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[11px] text-warm-text-secondary font-medium">{item.source}</span>
                  <span className="text-warm-border">·</span>
                  <span className="text-[11px] text-warm-text-secondary">{timeAgo(item.published_at)}</span>
                  <CategoryBadge category={item.category} />
                </div>
              </div>
              <ExternalLink
                size={14}
                className="text-warm-text-secondary mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </motion.a>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-warm-text-secondary text-center">
        News updated every 6 hours on weekdays, daily on weekends · Last updated: {formatTimestamp(news.updated_at)}
      </p>
    </motion.div>
  )
}
