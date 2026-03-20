import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  LineChart,
  Newspaper,
  BarChart3,
  BookOpen,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type TabId = 'dashboard' | 'charts' | 'news' | 'fundamentals' | 'brief' | 'settings'

const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'charts', label: 'Charts', icon: LineChart },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'fundamentals', label: 'Fundamentals', icon: BarChart3 },
  { id: 'brief', label: 'Desk Read', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface TabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-warm-card/95 backdrop-blur-md border-t border-warm-border safe-area-bottom">
      <div className="max-w-lg mx-auto flex justify-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-3 pt-3 relative transition-colors duration-200',
                isActive ? 'text-crude-amber' : 'text-warm-text-secondary hover:text-warm-text'
              )}
            >
              {isActive && (
                <motion.div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-crude-amber rounded-full"
                  layoutId="tab-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className={cn('text-[10px]', isActive ? 'font-semibold' : 'font-medium')}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
