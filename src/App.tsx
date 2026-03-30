import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { TabBar, type TabId } from '@/components/layout/TabBar'
import { DashboardTab } from '@/components/dashboard/DashboardTab'
import { ChartsTab } from '@/components/charts/ChartsTab'
import { NewsTab } from '@/components/news/NewsTab'
import { FundamentalsTab } from '@/components/fundamentals/FundamentalsTab'
import { BriefTab } from '@/components/brief/BriefTab'
import { SettingsTab } from '@/components/settings/SettingsTab'
import { usePrices, useNews, useBrief, useFundamentals } from '@/hooks/useData'
import { useTheme } from '@/hooks/useTheme'

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const { isDark, toggle: toggleTheme } = useTheme()
  const { data: prices } = usePrices()
  const { data: news } = useNews()
  const { data: brief } = useBrief()
  const { data: fundamentals } = useFundamentals()

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0 })
  }, [])
  const navigateToNews = useCallback(() => handleTabChange('news'), [handleTabChange])
  const navigateToBrief = useCallback(() => handleTabChange('brief'), [handleTabChange])

  const loading = !prices || !news

  const renderTab = () => {
    if (loading && activeTab !== 'settings') {
      return (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-crude-amber border-t-transparent rounded-full animate-spin" />
            <span className="text-warm-muted text-sm">Loading market data…</span>
          </div>
        </div>
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab
            prices={prices!}
            news={news!}
            onNavigateToNews={navigateToNews}
          />
        )
      case 'charts':
        return <ChartsTab />
      case 'news':
        return (
          <NewsTab
            news={news!}
            brief={brief}
            onNavigateToBrief={navigateToBrief}
          />
        )
      case 'fundamentals':
        return <FundamentalsTab data={fundamentals} />
      case 'brief':
        return <BriefTab brief={brief} />
      case 'settings':
        return (
          <SettingsTab
            isDark={isDark}
            onToggleTheme={toggleTheme}
            lastUpdated={prices?.updated_at || ''}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-warm-bg">
      <Header />

      <main className="max-w-5xl mx-auto px-4 pt-4 pb-20">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {renderTab()}
        </motion.div>
      </main>

      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}

export default App
