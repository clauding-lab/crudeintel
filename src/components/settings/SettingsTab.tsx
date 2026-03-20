import { motion } from 'framer-motion'
import { Sun, Moon, Bell, AlertTriangle, Database, Info, ExternalLink, Droplets } from 'lucide-react'
import { cn, formatTimestamp } from '@/lib/utils'

interface SettingsTabProps {
  isDark: boolean
  onToggleTheme: () => void
  lastUpdated: string
}

export function SettingsTab({ isDark, onToggleTheme, lastUpdated }: SettingsTabProps) {
  return (
    <motion.div
      className="space-y-4 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Theme toggle */}
      <motion.section
        className="bg-warm-card rounded-xl p-5 card-shadow"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="font-serif text-sm font-semibold text-warm-text mb-4">Appearance</h3>
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between p-3 rounded-lg bg-warm-bg hover:bg-warm-border-light transition-colors"
        >
          <div className="flex items-center gap-3">
            {isDark ? <Moon size={18} className="text-crude-amber" /> : <Sun size={18} className="text-crude-amber" />}
            <div className="text-left">
              <p className="text-sm font-medium text-warm-text">Theme</p>
              <p className="text-xs text-warm-text-secondary">{isDark ? 'Dark mode' : 'Light mode (CrudeIntel)'}</p>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full transition-colors relative',
            isDark ? 'bg-crude-amber' : 'bg-warm-border'
          )}>
            <motion.div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
              animate={{ left: isDark ? 18 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </div>
        </button>
      </motion.section>

      {/* Notifications (placeholder) */}
      <motion.section
        className="bg-warm-card rounded-xl p-5 card-shadow"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h3 className="font-serif text-sm font-semibold text-warm-text mb-4">Notifications</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-warm-bg opacity-60">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-warm-text-secondary" />
              <div>
                <p className="text-sm font-medium text-warm-text">Push Notifications</p>
                <p className="text-xs text-warm-text-secondary">Coming in Phase 2</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-warm-bg opacity-60">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-warm-text-secondary" />
              <div>
                <p className="text-sm font-medium text-warm-text">Price Alerts</p>
                <p className="text-xs text-warm-text-secondary">Notify when Brent moves &gt;3% in a day</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Data refresh status */}
      <motion.section
        className="bg-warm-card rounded-xl p-5 card-shadow"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-serif text-sm font-semibold text-warm-text mb-4">Data Status</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-warm-text">Last pipeline run</span>
            <span className="text-xs font-mono text-warm-text-secondary tabular-nums">
              {formatTimestamp(lastUpdated)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-warm-text">Prices</span>
            <span className="text-xs text-positive font-medium">Hourly (market hours)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-warm-text">News feed</span>
            <span className="text-xs text-positive font-medium">Every 6h weekdays</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-warm-text">Fundamentals</span>
            <span className="text-xs text-positive font-medium">Wed & Fri</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-warm-text">Energy Desk Read</span>
            <span className="text-xs text-positive font-medium">Daily 17:30 UTC</span>
          </div>
        </div>
      </motion.section>

      {/* Data sources */}
      <motion.section
        className="bg-warm-card rounded-xl p-5 card-shadow"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} className="text-crude-amber" />
          <h3 className="font-serif text-sm font-semibold text-warm-text">Data Sources</h3>
        </div>
        <div className="space-y-2">
          {[
            { name: 'Twelve Data', url: 'https://twelvedata.com', desc: 'Commodity price feeds' },
            { name: 'EIA', url: 'https://eia.gov', desc: 'US energy fundamentals' },
            { name: 'Financial Modeling Prep', url: 'https://financialmodelingprep.com', desc: 'Fallback price data' },
            { name: 'Baker Hughes', url: 'https://bakerhughes.com', desc: 'Rig count data' },
            { name: 'OPEC', url: 'https://opec.org', desc: 'Monthly oil market report' },
          ].map((source) => (
            <a
              key={source.name}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-warm-bg transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-warm-text">{source.name}</p>
                <p className="text-[11px] text-warm-text-secondary">{source.desc}</p>
              </div>
              <ExternalLink size={12} className="text-warm-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      </motion.section>

      {/* About */}
      <motion.section
        className="bg-warm-card rounded-xl p-5 card-shadow"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Info size={16} className="text-crude-amber" />
          <h3 className="font-serif text-sm font-semibold text-warm-text">About</h3>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Droplets size={20} className="text-crude-amber" />
            <span className="font-serif text-lg font-bold text-warm-text">CrudeIntel</span>
          </div>
          <p className="text-xs text-warm-text-secondary italic mb-3">The energy briefing.</p>
          <p className="text-xs text-warm-text-secondary leading-relaxed">
            Crude oil, LNG prices, and AI-powered energy intelligence.
            <br />
            Built by Adnan Rashid. Intelligence layer powered by Claude AI.
          </p>
          <p className="text-[10px] text-warm-text-secondary mt-3">Version 1.0.0</p>
        </div>
      </motion.section>
    </motion.div>
  )
}
