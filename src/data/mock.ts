import type { PricesLatest, NewsFeed, EnergyBrief, Fundamentals, PriceHistory } from '@/types/data'

export const mockPrices: PricesLatest = {
  updated_at: '2026-03-20T14:00:00Z',
  pipeline_status: 'success',
  prices: {
    brent: {
      price: 74.82,
      change: -0.53,
      change_pct: -0.70,
      currency: 'USD',
      unit: 'bbl',
      source: 'twelve_data',
      timestamp: '2026-03-20T14:00:00Z',
      sparkline_5d: [75.10, 74.95, 75.35, 75.35, 74.82],
    },
    urals: {
      price: 61.82,
      change: -0.53,
      change_pct: -0.85,
      currency: 'USD',
      unit: 'bbl',
      source: 'derived',
      discount_from_brent: 13.00,
      discount_source: 'manual',
      discount_updated: '2026-03-15',
      timestamp: '2026-03-20T14:00:00Z',
      sparkline_5d: [62.10, 61.95, 62.35, 62.35, 61.82],
    },
    henry_hub: {
      price: 3.42,
      change: 0.08,
      change_pct: 2.39,
      currency: 'USD',
      unit: 'MMBtu',
      source: 'twelve_data',
      timestamp: '2026-03-20T14:00:00Z',
      sparkline_5d: [3.30, 3.35, 3.38, 3.34, 3.42],
    },
    ttf: {
      price: 42.15,
      change: -0.80,
      change_pct: -1.86,
      currency: 'EUR',
      unit: 'MWh',
      source: 'twelve_data',
      timestamp: '2026-03-20T14:00:00Z',
      sparkline_5d: [43.00, 42.80, 42.95, 42.95, 42.15],
    },
    urals_india: {
      price: 99.00,
      change: -0.45,
      change_pct: -0.45,
      currency: 'USD',
      unit: 'bbl',
      source: 'derived',
      timestamp: '2026-03-20T14:00:00Z',
      sparkline_5d: [95.50, 96.80, 98.10, 99.50, 99.00],
    },
    jkm: {
      price: 20.18,
      change: 0.90,
      change_pct: 4.67,
      currency: 'USD',
      unit: 'MMBtu',
      source: 'yahoo_finance',
      timestamp: '2026-03-20T14:00:00Z',
      sparkline_5d: [19.27, 19.27, 19.41, 20.18, 22.35],
    },
  },
  reference: {
    wti: { price: 71.20, change_pct: -0.65 },
    opec_basket: { price: 72.50, change_pct: -0.45 },
    usd_rub: { rate: 87.50, change_pct: 0.12 },
  },
}

export const mockNews: NewsFeed = {
  updated_at: '2026-03-20T12:00:00Z',
  items: [
    {
      id: 'news-20260320-001',
      title: 'OPEC+ considers extending output cuts through Q3 as demand concerns persist',
      source: 'Reuters',
      url: 'https://reuters.com',
      published_at: '2026-03-20T10:30:00Z',
      category: 'opec_plus',
      ai_summary: 'Saudi Arabia signals willingness to maintain voluntary cuts, supporting Brent floor around $72-75 range.',
      ai_category_confidence: 0.95,
    },
    {
      id: 'news-20260320-002',
      title: 'US crude inventories fall by 2.1 million barrels, beating expectations',
      source: 'EIA',
      url: 'https://eia.gov',
      published_at: '2026-03-20T09:00:00Z',
      category: 'supply',
      ai_summary: 'Larger-than-expected draw suggests robust refinery demand ahead of spring maintenance season.',
      ai_category_confidence: 0.92,
    },
    {
      id: 'news-20260320-003',
      title: 'EU weighs tighter enforcement of Russian oil price cap amid evasion concerns',
      source: 'Financial Times',
      url: 'https://ft.com',
      published_at: '2026-03-20T07:15:00Z',
      category: 'russia_sanctions',
      ai_summary: 'Shadow fleet crackdown could compress Urals discount further if enforcement materializes.',
      ai_category_confidence: 0.88,
    },
    {
      id: 'news-20260320-004',
      title: 'China LNG imports rise 12% year-on-year as industrial recovery gains momentum',
      source: 'Bloomberg',
      url: 'https://bloomberg.com',
      published_at: '2026-03-19T22:00:00Z',
      category: 'lng',
      ai_summary: 'Chinese demand recovery supporting TTF and JKM benchmarks as spot cargo competition intensifies.',
      ai_category_confidence: 0.91,
    },
    {
      id: 'news-20260320-005',
      title: 'Baker Hughes: US oil rig count drops by 3 to 479, lowest since September',
      source: 'Baker Hughes',
      url: 'https://bakerhughes.com',
      published_at: '2026-03-19T19:00:00Z',
      category: 'supply',
      ai_summary: 'Declining rig activity signals potential production plateau in coming months, bullish for medium-term supply outlook.',
      ai_category_confidence: 0.94,
    },
    {
      id: 'news-20260320-006',
      title: 'Strait of Hormuz tensions ease as Iran diplomatic channels reopen',
      source: 'Al Jazeera',
      url: 'https://aljazeera.com',
      published_at: '2026-03-19T16:30:00Z',
      category: 'geopolitics',
      ai_summary: 'Reduced geopolitical premium as diplomatic efforts reduce risk of supply disruption through the strait.',
      ai_category_confidence: 0.87,
    },
    {
      id: 'news-20260320-007',
      title: 'Indian refiners increase Russian Urals purchases to record levels in February',
      source: 'Reuters',
      url: 'https://reuters.com',
      published_at: '2026-03-19T14:00:00Z',
      category: 'russia_sanctions',
      ai_summary: 'India continues to absorb discounted Russian crude, maintaining Urals-Brent spread around $13.',
      ai_category_confidence: 0.90,
    },
    {
      id: 'news-20260320-008',
      title: 'European gas storage levels 15% below five-year average as winter drawdown exceeds forecasts',
      source: 'GIE',
      url: 'https://gie.eu',
      published_at: '2026-03-19T11:00:00Z',
      category: 'demand',
      ai_summary: 'Below-average storage levels could support TTF prices through injection season, despite mild weather forecasts.',
      ai_category_confidence: 0.89,
    },
  ],
}

export const mockBrief: EnergyBrief = {
  date: '2026-03-20',
  generated_at: '2026-03-20T17:35:00Z',
  headline: 'Brent Tests $75 Support as OPEC+ Signals Hold Steady',
  sections: {
    market_recap: 'Brent crude settled at $74.82, down 0.7% on the session, as mixed signals from OPEC+ dialogue kept the market in a holding pattern. The key support level at $72 remains intact, bolstered by Saudi Arabia\'s clear signalling that voluntary cuts will persist through at least Q3. Henry Hub natural gas bucked the trend, rising 2.4% to $3.42/MMBtu on a larger-than-expected storage draw and cooler weather forecasts extending into late March.\n\nThe Urals-Brent spread held steady at $13, with Indian refiners continuing to absorb Russian barrels at record pace. EU discussions around tightening price cap enforcement remain more rhetoric than action, but any material crackdown would be immediately visible in the spread — making it the key canary in the sanctions-enforcement coal mine.\n\nTTF natural gas slipped 1.9% to €42.15/MWh as mild temperatures reduced heating demand, though below-average storage levels (15% under the 5-year mean) provide a structural floor heading into the injection season.',
    key_developments: [
      {
        item: 'OPEC+ extends voluntary cuts signal through Q3',
        so_what: 'Supports $70-80 Brent range through H1, limits downside for procurement hedges',
      },
      {
        item: 'US crude inventories draw 2.1mb vs expected 0.5mb build',
        so_what: 'Refinery demand remains robust ahead of maintenance season — bullish for crack spreads',
      },
      {
        item: 'EU weighs tighter Russian oil price cap enforcement',
        so_what: 'Watch the Urals-Brent spread — if enforcement bites, discount widens from current $13 toward $18-20',
      },
      {
        item: 'China LNG imports up 12% y/y in February',
        so_what: 'Spot cargo competition will intensify in Q2, supporting TTF and adding pressure on US LNG export margins',
      },
    ],
    geopolitical_radar: 'Strait of Hormuz: REDUCED RISK — Iranian diplomatic channels reopening reduce near-term disruption risk, though structural tensions persist. Russia/Sanctions: ELEVATED WATCH — EU enforcement rhetoric increasing, but shadow fleet continues operating. Real test comes with Greek-flagged vessel inspections announced for April. OPEC+ Dynamics: STABLE — Saudi-Russia coordination remains strong, with both signalling preference for price stability over market share. US Policy: NEUTRAL — SPR repurchasing on schedule at ~3mb/month, no significant policy changes expected pre-midterms.',
    desk_implications: [
      'Near-term Brent floor likely at $72 given OPEC+ posture — procurement teams can lean into current levels for Q2 cover',
      'Urals discount compression from $15 to $13 over past 6 weeks suggests sanctions enforcement loosening — watch Indian import data next week for confirmation',
      'TTF below-average storage creates asymmetric risk heading into injection season — consider locking in forward gas prices before April demand materializes',
    ],
    data_watch: [
      { date: '2026-03-21', event: 'Baker Hughes Rig Count', relevance: 'US supply signal — 3rd consecutive weekly decline would confirm activity slowdown' },
      { date: '2026-03-25', event: 'EIA Short-Term Energy Outlook', relevance: 'Updated 2026 production and demand forecasts' },
      { date: '2026-03-26', event: 'EIA Weekly Petroleum Report', relevance: 'Inventory build/draw — focus on Cushing hub levels' },
      { date: '2026-03-27', event: 'US GDP Q4 Final Revision', relevance: 'Demand-side signal via economic activity confirmation' },
    ],
  },
  branding: {
    author: 'Adnan Rashid',
    product: 'The energy briefing.',
    ai_disclosure: 'Produced with Claude AI',
  },
}

export const mockFundamentals: Fundamentals = {
  updated_at: '2026-03-19T16:30:00Z',
  eia_inventories: {
    current_week: { date: '2026-03-14', value_mb: 435.2, change_mb: -2.1 },
    five_year_avg_mb: 440.5,
    history_12w: [442.0, 441.5, 440.8, 439.2, 438.5, 437.1, 436.8, 437.5, 438.2, 437.0, 437.3, 435.2],
  },
  baker_hughes_rig_count: {
    date: '2026-03-14',
    oil_rigs: 479,
    change: -3,
    history_26w: [510, 508, 505, 502, 500, 498, 497, 495, 494, 493, 492, 491, 490, 489, 488, 487, 486, 485, 484, 483, 483, 482, 482, 481, 482, 479],
  },
  opec_compliance: {
    report_date: '2026-03-01',
    source: 'OPEC MOMR',
    members: [
      { country: 'Saudi Arabia', quota_mbd: 9.0, estimated_mbd: 8.95, compliance_pct: 99 },
      { country: 'Russia', quota_mbd: 9.5, estimated_mbd: 9.65, compliance_pct: 84 },
      { country: 'Iraq', quota_mbd: 4.0, estimated_mbd: 4.12, compliance_pct: 70 },
      { country: 'UAE', quota_mbd: 2.9, estimated_mbd: 2.88, compliance_pct: 97 },
      { country: 'Kuwait', quota_mbd: 2.4, estimated_mbd: 2.38, compliance_pct: 99 },
      { country: 'Kazakhstan', quota_mbd: 1.5, estimated_mbd: 1.58, compliance_pct: 47 },
      { country: 'Nigeria', quota_mbd: 1.4, estimated_mbd: 1.35, compliance_pct: 96 },
      { country: 'Algeria', quota_mbd: 0.9, estimated_mbd: 0.89, compliance_pct: 99 },
    ],
  },
  refinery_utilization: {
    date: '2026-03-14',
    value_pct: 87.3,
    history_12w: [85.1, 85.8, 86.2, 86.5, 86.8, 87.0, 86.5, 86.8, 87.1, 87.0, 87.2, 87.3],
  },
  us_production: {
    date: '2026-03-14',
    value_mbd: 13.1,
    history_26w: [12.8, 12.8, 12.9, 12.9, 12.9, 13.0, 13.0, 13.0, 13.0, 13.0, 13.1, 13.1, 13.1, 13.0, 13.0, 13.1, 13.1, 13.1, 13.1, 13.1, 13.1, 13.1, 13.1, 13.1, 13.1, 13.1],
  },
}

export const mockBrentHistory: PriceHistory = {
  commodity: 'brent',
  interval: 'daily',
  data: Array.from({ length: 90 }, (_, i) => {
    const date = new Date('2026-03-20')
    date.setDate(date.getDate() - (89 - i))
    const basePrice = 73 + Math.sin(i / 10) * 3 + Math.random() * 2
    return {
      date: date.toISOString().split('T')[0],
      open: Number((basePrice + Math.random() * 0.5).toFixed(2)),
      high: Number((basePrice + 0.5 + Math.random() * 0.8).toFixed(2)),
      low: Number((basePrice - 0.5 - Math.random() * 0.8).toFixed(2)),
      close: Number((basePrice + (Math.random() - 0.5) * 1).toFixed(2)),
      volume: Math.floor(200000 + Math.random() * 100000),
    }
  }),
}
