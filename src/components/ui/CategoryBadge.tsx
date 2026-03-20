import { cn } from '@/lib/utils'

const categoryConfig: Record<string, { label: string; color: string }> = {
  opec_plus: { label: 'OPEC+', color: 'bg-crude-amber-muted text-crude-amber' },
  geopolitics: { label: 'Geopolitics', color: 'bg-negative-bg text-negative' },
  supply: { label: 'Supply', color: 'bg-positive-bg text-positive' },
  demand: { label: 'Demand', color: 'bg-[rgba(71,85,105,0.1)] text-slate-accent' },
  lng: { label: 'LNG', color: 'bg-[rgba(71,85,105,0.1)] text-slate-accent' },
  russia_sanctions: { label: 'Russia/Sanctions', color: 'bg-negative-bg text-negative' },
}

interface CategoryBadgeProps {
  category: string
  className?: string
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const config = categoryConfig[category] || { label: category, color: 'bg-warm-border-light text-warm-text-secondary' }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  )
}
