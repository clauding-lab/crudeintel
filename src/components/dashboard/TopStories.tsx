import { motion } from 'framer-motion'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { timeAgo } from '@/lib/utils'
import type { NewsItem } from '@/types/data'

interface TopStoriesProps {
  items: NewsItem[]
  onViewAll: () => void
}

export function TopStories({ items, onViewAll }: TopStoriesProps) {
  const topItems = items.slice(0, 3)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.55 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-base font-semibold text-warm-text">Top Stories</h2>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs font-medium text-crude-amber hover:underline"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>
      <div className="space-y-2.5">
        {topItems.map((item, i) => (
          <motion.a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-warm-card rounded-lg p-3.5 card-shadow hover:card-shadow-lg transition-shadow group"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.6 + i * 0.08 }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-warm-text leading-snug group-hover:text-crude-amber transition-colors line-clamp-2">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
      </div>
    </motion.section>
  )
}
