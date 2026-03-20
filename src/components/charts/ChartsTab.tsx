import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { createChart, ColorType, LineStyle, LineSeries, CandlestickSeries } from 'lightweight-charts'
import type { IChartApi } from 'lightweight-charts'
import { cn } from '@/lib/utils'
import { useChartData } from '@/hooks/useData'
import type { PriceHistoryPoint } from '@/types/data'

type CommodityId = 'brent' | 'urals' | 'henry_hub' | 'ttf' | 'urals_india' | 'jkm'
type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'
type ChartType = 'line' | 'candlestick'

const commodities: { id: CommodityId; label: string }[] = [
  { id: 'brent', label: 'Brent' },
  { id: 'urals', label: 'Urals Est.' },
  { id: 'henry_hub', label: 'Henry Hub' },
  { id: 'ttf', label: 'TTF' },
  { id: 'urals_india', label: 'Urals (India)' },
  { id: 'jkm', label: 'LNG JKM' },
]

const COMMODITY_INFO = [
  {
    id: 'brent' as CommodityId,
    label: 'Brent Crude',
    description: 'The leading global price benchmark for Atlantic basin crude oils, used to price approximately two-thirds to 80% of the world\'s internationally traded crude oil.',
    url: 'https://www.investopedia.com/ask/answers/052615/what-difference-between-brent-crude-and-west-texas-intermediate.asp',
  },
  {
    id: 'urals' as CommodityId,
    label: 'Urals Est.',
    description: 'The primary benchmark for Russian crude oil exports. A medium-sour blend that serves as a key reference for international markets, particularly in Europe and Asia.',
    url: 'https://cbonds.com/indexes/urals-crude-oil/',
  },
  {
    id: 'henry_hub' as CommodityId,
    label: 'Henry Hub',
    description: 'The primary pricing benchmark for the North American natural gas market, used globally as a reference for liquefied natural gas (LNG) contracts.',
    url: 'https://en.wikipedia.org/wiki/Henry_Hub',
  },
  {
    id: 'ttf' as CommodityId,
    label: 'TTF',
    description: 'Title Transfer Facility is a virtual trading point in the Netherlands that serves as the leading price benchmark for natural gas across continental Europe.',
    url: 'https://en.wikipedia.org/wiki/Title_Transfer_Facility',
  },
  {
    id: 'urals_india' as CommodityId,
    label: 'Urals (India)',
    description: 'Estimated CIF price of Russian Urals crude delivered to India\'s west coast, including freight. India is the largest buyer of Russian crude since 2022 sanctions.',
    url: 'https://www.themoscowtimes.com/2026/03/16/russian-urals-crude-delivered-to-india-nears-100-as-iran-war-lifts-prices-a92239',
  },
  {
    id: 'jkm' as CommodityId,
    label: 'LNG Japan/Korea Marker',
    description: 'LNG Japan/Korea Marker PLATTS Future — the key LNG spot price benchmark for Asia-Pacific, reflecting delivered ex-ship values into Japan, South Korea, China and Taiwan.',
    url: 'https://www.investing.com/commodities/lng-japan-korea-marker-platts-futures',
  },
]

const timeRanges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL']

function getTimeRangeDays(range: TimeRange): number {
  switch (range) {
    case '1W': return 7
    case '1M': return 30
    case '3M': return 90
    case '6M': return 180
    case '1Y': return 365
    case 'ALL': return 9999
  }
}

function buildChart(
  container: HTMLElement,
  commodity: CommodityId,
  timeRange: TimeRange,
  chartType: ChartType,
  chartData: PriceHistoryPoint[],
): IChartApi {
  const isDark = document.documentElement.classList.contains('dark')

  const chart = createChart(container, {
    width: container.clientWidth || 400,
    height: 320,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: isDark ? '#a8a29e' : '#78716c',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: isDark ? '#44403c' : '#f5f5f4', style: LineStyle.Dotted },
      horzLines: { color: isDark ? '#44403c' : '#f5f5f4', style: LineStyle.Dotted },
    },
    crosshair: {
      vertLine: { color: '#b45309', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#b45309' },
      horzLine: { color: '#b45309', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#b45309' },
    },
    rightPriceScale: { borderColor: isDark ? '#44403c' : '#e7e5e4' },
    timeScale: { borderColor: isDark ? '#44403c' : '#e7e5e4', timeVisible: false },
  })

  const days = getTimeRangeDays(timeRange)
  const filteredData = days >= chartData.length ? chartData : chartData.slice(-days)

  if (filteredData.length === 0) {
    // No data — show empty chart
    chart.timeScale().fitContent()
    return chart
  }

  if (chartType === 'candlestick') {
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#b91c1c',
      downColor: '#166534',
      borderUpColor: '#b91c1c',
      borderDownColor: '#166534',
      wickUpColor: '#b91c1c',
      wickDownColor: '#166534',
    })
    series.setData(filteredData.map((d) => ({
      time: d.date, open: d.open, high: d.high, low: d.low, close: d.close,
    })))
  } else {
    const color = commodity === 'urals_india' ? '#7c3aed' : commodity === 'jkm' ? '#0891b2' : '#b45309'
    const series = chart.addSeries(LineSeries, {
      color, lineWidth: 2, crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: color, crosshairMarkerBackgroundColor: '#ffffff',
    })
    series.setData(filteredData.map((d) => ({ time: d.date, value: d.close })))
  }

  chart.timeScale().fitContent()
  return chart
}

export function ChartsTab() {
  const [commodity, setCommodity] = useState<CommodityId>('brent')
  const [timeRange, setTimeRange] = useState<TimeRange>('3M')
  const [chartType, setChartType] = useState<ChartType>('line')
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  // Use real Supabase data via hook
  const { data: chartData, loading } = useChartData(commodity)

  const destroyChart = useCallback(() => {
    if (chartRef.current) {
      try { chartRef.current.remove() } catch { /* already disposed */ }
      chartRef.current = null
    }
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    const container = chartContainerRef.current
    if (!container || loading || !chartData.data.length) return

    // Destroy any previous chart
    destroyChart()

    // Delay chart creation slightly so container has layout
    const timer = requestAnimationFrame(() => {
      if (!container.isConnected) return
      chartRef.current = buildChart(container, commodity, timeRange, chartType, chartData.data)
    })

    const handleResize = () => {
      if (chartRef.current && container.clientWidth > 0) {
        chartRef.current.applyOptions({ width: container.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(timer)
      window.removeEventListener('resize', handleResize)
      destroyChart()
    }
  }, [commodity, timeRange, chartType, chartData, loading, destroyChart])

  return (
    <motion.div
      className="space-y-4 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {commodities.map((c) => (
          <button
            key={c.id}
            onClick={() => setCommodity(c.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              commodity === c.id
                ? 'bg-crude-amber text-white'
                : 'bg-warm-card text-warm-text-secondary hover:text-warm-text card-shadow'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-mono font-medium transition-all',
                timeRange === range
                  ? 'bg-crude-amber-muted text-crude-amber'
                  : 'text-warm-text-secondary hover:text-warm-text'
              )}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-warm-card rounded-lg p-0.5 card-shadow">
          <button
            onClick={() => setChartType('line')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-all',
              chartType === 'line' ? 'bg-crude-amber-muted text-crude-amber' : 'text-warm-text-secondary'
            )}
          >
            Line
          </button>
          <button
            onClick={() => setChartType('candlestick')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-all',
              chartType === 'candlestick' ? 'bg-crude-amber-muted text-crude-amber' : 'text-warm-text-secondary'
            )}
          >
            Candle
          </button>
        </div>
      </div>

      <div className="bg-warm-card rounded-xl p-3 card-shadow overflow-hidden">
        {loading ? (
          <div className="w-full flex items-center justify-center text-warm-text-secondary text-xs" style={{ height: 320 }}>
            Loading chart data...
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full" style={{ height: 320 }} />
        )}
      </div>

      <p className="text-[10px] text-warm-text-secondary text-center">
        {commodity === 'urals' || commodity === 'urals_india' ? (
          <em>Derived estimate — dashed borders indicate estimated data</em>
        ) : (
          `Source: Supabase · ${chartData.data.length} days of daily data`
        )}
      </p>

      {/* Commodity Reference Tiles */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {COMMODITY_INFO.map((info) => (
          <a
            key={info.id}
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'block bg-warm-card rounded-xl p-3.5 card-shadow transition-all hover:scale-[1.02]',
              commodity === info.id && 'ring-1 ring-crude-amber/40'
            )}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs font-semibold text-warm-text">{info.label}</span>
              <svg className="w-3 h-3 text-warm-text-secondary opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3.5 1.5h7m0 0v7m0-7L2 10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[10px] leading-relaxed text-warm-text-secondary">
              {info.description}
            </p>
          </a>
        ))}
      </div>
    </motion.div>
  )
}
