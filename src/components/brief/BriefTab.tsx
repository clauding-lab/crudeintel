import { motion } from 'framer-motion'
import { BookOpen, AlertTriangle, Target, Calendar, ChevronRight } from 'lucide-react'
import { formatDate, formatTimestamp } from '@/lib/utils'
import type { EnergyBrief } from '@/types/data'

interface BriefTabProps {
  brief: EnergyBrief | null
}

export function BriefTab({ brief }: BriefTabProps) {
  if (!brief) return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-crude-amber border-t-transparent rounded-full animate-spin" />
        <span className="text-warm-muted text-sm">Loading brief…</span>
      </div>
    </div>
  )

  const { sections, branding } = brief

  return (
    <motion.div
      className="pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Masthead */}
      <motion.div
        className="text-center pt-2 pb-6 border-b border-warm-border mb-6"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="text-[10px] text-crude-amber uppercase tracking-[0.2em] font-medium mb-1">
          Energy Desk Read
        </p>
        <h1 className="font-serif text-2xl font-bold text-warm-text leading-tight px-2 mb-2">
          {brief.headline}
        </h1>
        <p className="text-xs text-warm-text-secondary">
          {formatDate(brief.date)} · {branding.product}
        </p>
      </motion.div>

      {/* Market Recap */}
      <motion.section
        className="mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-crude-amber-muted flex items-center justify-center">
            <BookOpen size={13} className="text-crude-amber" />
          </div>
          <h2 className="font-serif text-base font-semibold text-warm-text">Market Recap</h2>
        </div>
        <div className="space-y-4 text-sm text-warm-text leading-relaxed">
          {sections.market_recap.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </motion.section>

      {/* Key Developments */}
      <motion.section
        className="mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-crude-amber-muted flex items-center justify-center">
            <AlertTriangle size={13} className="text-crude-amber" />
          </div>
          <h2 className="font-serif text-base font-semibold text-warm-text">Key Developments</h2>
        </div>
        <div className="space-y-3">
          {sections.key_developments.map((dev, i) => (
            <motion.div
              key={i}
              className="bg-warm-card rounded-lg p-4 card-shadow"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.08 }}
            >
              <p className="text-sm font-medium text-warm-text leading-snug mb-1.5">{dev.item}</p>
              <div className="flex items-start gap-1.5">
                <ChevronRight size={12} className="text-crude-amber mt-0.5 flex-shrink-0" />
                <p className="text-xs text-warm-text-secondary italic leading-relaxed">
                  <span className="text-crude-amber font-medium not-italic">So what?</span> {dev.so_what}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Geopolitical Radar */}
      <motion.section
        className="mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-crude-amber-muted flex items-center justify-center">
            <AlertTriangle size={13} className="text-crude-amber" />
          </div>
          <h2 className="font-serif text-base font-semibold text-warm-text">Geopolitical Radar</h2>
        </div>
        <div className="bg-warm-card rounded-lg p-4 card-shadow">
          <p className="text-sm text-warm-text leading-relaxed">{sections.geopolitical_radar}</p>
        </div>
      </motion.section>

      {/* Desk Implications */}
      <motion.section
        className="mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-crude-amber-muted flex items-center justify-center">
            <Target size={13} className="text-crude-amber" />
          </div>
          <h2 className="font-serif text-base font-semibold text-warm-text">Desk Implications</h2>
        </div>
        <div className="space-y-2.5">
          {sections.desk_implications.map((impl, i) => (
            <motion.div
              key={i}
              className="bg-warm-card rounded-lg p-4 card-shadow border-l-[3px] border-crude-amber"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.65 + i * 0.08 }}
            >
              <p className="text-sm text-warm-text leading-relaxed">{impl}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Data Watch */}
      <motion.section
        className="mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-crude-amber-muted flex items-center justify-center">
            <Calendar size={13} className="text-crude-amber" />
          </div>
          <h2 className="font-serif text-base font-semibold text-warm-text">Data Watch</h2>
        </div>
        <div className="bg-warm-card rounded-xl p-4 card-shadow">
          <div className="space-y-3">
            {sections.data_watch.map((event, i) => {
              const eventDate = new Date(event.date)
              const dayName = eventDate.toLocaleDateString('en-GB', { weekday: 'short' })
              const dayNum = eventDate.getDate()
              const month = eventDate.toLocaleDateString('en-GB', { month: 'short' })

              return (
                <motion.div
                  key={i}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.06 }}
                >
                  <div className="w-12 text-center flex-shrink-0">
                    <p className="text-[10px] text-warm-text-secondary uppercase">{dayName}</p>
                    <p className="text-lg font-mono font-semibold text-warm-text leading-tight">{dayNum}</p>
                    <p className="text-[10px] text-warm-text-secondary uppercase">{month}</p>
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-medium text-warm-text">{event.event}</p>
                    <p className="text-xs text-warm-text-secondary mt-0.5">{event.relevance}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </motion.section>

      {/* Branded footer */}
      <motion.footer
        className="text-center pt-6 border-t border-warm-border"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p className="font-serif text-sm text-warm-text-secondary italic mb-1">{branding.product}</p>
        <p className="text-[10px] text-warm-text-secondary">
          Curated by {branding.author} · {branding.ai_disclosure}
        </p>
        <p className="text-[10px] text-warm-text-secondary mt-1">
          Generated: {formatTimestamp(brief.generated_at)}
        </p>
      </motion.footer>
    </motion.div>
  )
}
