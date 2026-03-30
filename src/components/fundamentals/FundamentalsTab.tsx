import { motion } from 'framer-motion'
import { BarChart3, Activity, Factory, Droplets, TrendingDown, TrendingUp } from 'lucide-react'
import { Sparkline } from '@/components/ui/Sparkline'
import { cn, formatTimestamp } from '@/lib/utils'
import type { Fundamentals } from '@/types/data'

interface FundamentalsTabProps {
  data: Fundamentals | null
}

// Fundamentals use standard convention: green = good, red = bad
// (opposite of commodity price tiles where up = red, down = green)
function complianceColor(pct: number): string {
  if (pct >= 95) return 'text-[#166534] dark:text-[#4ade80]'
  if (pct >= 80) return 'text-crude-amber'
  return 'text-[#b91c1c] dark:text-[#f87171]'
}

function complianceBg(pct: number): string {
  if (pct >= 95) return 'bg-[rgba(22,101,52,0.08)] dark:bg-[rgba(74,222,128,0.12)]'
  if (pct >= 80) return 'bg-crude-amber-muted'
  return 'bg-[rgba(185,28,28,0.08)] dark:bg-[rgba(248,113,113,0.12)]'
}

export function FundamentalsTab({ data }: FundamentalsTabProps) {
  if (!data) return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-crude-amber border-t-transparent rounded-full animate-spin" />
        <span className="text-warm-muted text-sm">Loading fundamentals…</span>
      </div>
    </div>
  )

  const { eia_inventories, baker_hughes_rig_count, opec_compliance, refinery_utilization, us_production } = data

  return (
    <motion.div
      className="space-y-5 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* EIA Inventories */}
      <motion.section
        className="bg-warm-card rounded-xl p-5 card-shadow"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-crude-amber" />
          <h3 className="font-serif text-sm font-semibold text-warm-text">US Crude Inventories</h3>
        </div>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-2xl font-mono font-semibold tabular-nums text-warm-text">
              {eia_inventories.current_week.value_mb.toFixed(1)}
            </span>
            <span className="text-xs text-warm-text-secondary ml-1">mb</span>
          </div>
          <div className={cn(
            'flex items-center gap-1 text-sm font-mono font-medium',
            eia_inventories.current_week.change_mb < 0 ? 'text-[#b91c1c] dark:text-[#f87171]' : 'text-[#166534] dark:text-[#4ade80]'
          )}>
            {eia_inventories.current_week.change_mb < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            {eia_inventories.current_week.change_mb > 0 ? '+' : ''}
            {eia_inventories.current_week.change_mb.toFixed(1)} mb
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Sparkline data={eia_inventories.history_12w} width={180} height={36} color="#b45309" />
          <div className="text-right">
            <p className="text-[10px] text-warm-text-secondary">5-year avg</p>
            <p className="text-xs font-mono text-warm-text-secondary">{eia_inventories.five_year_avg_mb.toFixed(1)} mb</p>
          </div>
        </div>
      </motion.section>

      {/* Baker Hughes & Refinery side by side */}
      <div className="grid grid-cols-2 gap-3">
        <motion.section
          className="bg-warm-card rounded-xl p-4 card-shadow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Activity size={14} className="text-crude-amber" />
            <h3 className="text-xs font-semibold text-warm-text">Rig Count</h3>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-semibold tabular-nums text-warm-text">
              {baker_hughes_rig_count.oil_rigs}
            </span>
            <span className={cn(
              'text-xs font-mono font-medium',
              baker_hughes_rig_count.change < 0 ? 'text-[#b91c1c] dark:text-[#f87171]' : 'text-[#166534] dark:text-[#4ade80]'
            )}>
              {baker_hughes_rig_count.change > 0 ? '+' : ''}{baker_hughes_rig_count.change}
            </span>
          </div>
          <Sparkline
            data={baker_hughes_rig_count.history_26w.slice(-12)}
            width={100}
            height={28}
            color="#475569"
          />
        </motion.section>

        <motion.section
          className="bg-warm-card rounded-xl p-4 card-shadow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Factory size={14} className="text-crude-amber" />
            <h3 className="text-xs font-semibold text-warm-text">Refinery Util.</h3>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-mono font-semibold tabular-nums text-warm-text">
              {refinery_utilization.value_pct.toFixed(1)}
            </span>
            <span className="text-xs text-warm-text-secondary">%</span>
          </div>
          <Sparkline
            data={refinery_utilization.history_12w}
            width={100}
            height={28}
            color="#475569"
          />
        </motion.section>
      </div>

      {/* US Production */}
      <motion.section
        className="bg-warm-card rounded-xl p-4 card-shadow"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Droplets size={14} className="text-crude-amber" />
          <h3 className="text-xs font-semibold text-warm-text">US Crude Production</h3>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-semibold tabular-nums text-warm-text">
              {us_production.value_mbd.toFixed(1)}
            </span>
            <span className="text-xs text-warm-text-secondary">mb/d</span>
          </div>
          <Sparkline
            data={us_production.history_26w.slice(-12)}
            width={120}
            height={28}
            color="#475569"
          />
        </div>
      </motion.section>

      {/* OPEC+ Compliance */}
      <motion.section
        className="bg-warm-card rounded-xl p-5 card-shadow"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-sm font-semibold text-warm-text">OPEC+ Compliance</h3>
          <span className="text-[10px] text-warm-text-secondary">
            {opec_compliance.source} · {opec_compliance.report_date}
          </span>
        </div>
        <div className="space-y-2.5">
          {opec_compliance.members.map((member, i) => (
            <motion.div
              key={member.country}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
            >
              <span className="text-xs font-medium text-warm-text w-24 truncate">{member.country}</span>
              <div className="flex-1 h-1.5 bg-warm-border-light rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    member.compliance_pct >= 95 ? 'bg-[#166534] dark:bg-[#4ade80]' : member.compliance_pct >= 80 ? 'bg-crude-amber' : 'bg-[#b91c1c] dark:bg-[#f87171]'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(member.compliance_pct, 100)}%` }}
                  transition={{ duration: 0.6, delay: 0.4 + i * 0.05 }}
                />
              </div>
              <span className={cn(
                'text-xs font-mono font-medium w-10 text-right tabular-nums',
                complianceColor(member.compliance_pct)
              )}>
                {member.compliance_pct}%
              </span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded',
                complianceBg(member.compliance_pct),
                complianceColor(member.compliance_pct)
              )}>
                {member.estimated_mbd.toFixed(2)}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <p className="text-[10px] text-warm-text-secondary text-center">
        Fundamentals via EIA & Baker Hughes · Last updated: {formatTimestamp(data.updated_at)}
      </p>
    </motion.div>
  )
}
