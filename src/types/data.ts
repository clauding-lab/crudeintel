export interface PriceData {
  price: number
  change: number
  change_pct: number
  currency: string
  unit: string
  source: string
  timestamp: string
  sparkline_5d: number[]
  discount_from_brent?: number
  discount_source?: string
  discount_updated?: string
}

export interface SpreadData {
  value: number
  trend_30d: number[]
  direction: 'widening' | 'narrowing' | 'stable'
}

export interface ReferencePrice {
  price?: number
  rate?: number
  change_pct: number
}

export interface PricesLatest {
  updated_at: string
  pipeline_status: string
  prices: {
    brent: PriceData
    urals: PriceData
    henry_hub: PriceData
    ttf: PriceData
    urals_india: PriceData
    jkm: PriceData
  }
  reference: {
    wti: ReferencePrice
    opec_basket: ReferencePrice
    usd_rub: ReferencePrice
  }
}

export interface PriceHistoryPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface PriceHistory {
  commodity: string
  interval: string
  data: PriceHistoryPoint[]
}

export interface NewsItem {
  id: string
  title: string
  source: string
  url: string
  published_at: string
  category: string
  ai_summary: string
  ai_category_confidence: number
}

export interface NewsFeed {
  updated_at: string
  items: NewsItem[]
}

export interface KeyDevelopment {
  item: string
  so_what: string
}

export interface DataWatchEvent {
  date: string
  event: string
  relevance: string
}

export interface EnergyBrief {
  date: string
  generated_at: string
  headline: string
  sections: {
    market_recap: string
    key_developments: KeyDevelopment[]
    geopolitical_radar: string
    desk_implications: string[]
    data_watch: DataWatchEvent[]
  }
  branding: {
    author: string
    product: string
    ai_disclosure: string
  }
}

export interface OPECMember {
  country: string
  quota_mbd: number
  estimated_mbd: number
  compliance_pct: number
}

export interface Fundamentals {
  updated_at: string
  eia_inventories: {
    current_week: { date: string; value_mb: number; change_mb: number }
    five_year_avg_mb: number
    history_12w: number[]
  }
  baker_hughes_rig_count: {
    date: string
    oil_rigs: number
    change: number
    history_26w: number[]
  }
  opec_compliance: {
    report_date: string
    source: string
    members: OPECMember[]
  }
  refinery_utilization: {
    date: string
    value_pct: number
    history_12w: number[]
  }
  us_production: {
    date: string
    value_mbd: number
    history_26w: number[]
  }
}

export type NewsCategory = 'all' | 'opec_plus' | 'geopolitics' | 'supply' | 'demand' | 'lng' | 'russia_sanctions'
