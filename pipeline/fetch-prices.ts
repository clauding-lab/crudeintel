/**
 * Pipeline: Fetch commodity prices from multiple free sources
 *
 * Sources:
 *   - Trading Economics (scrape, no key) → Brent, WTI, Henry Hub, TTF, JKM, Urals, USD/RUB
 *   - Yahoo Finance (fallback for live quotes + historical OHLCV for charts)
 *   - Twelve Data (fallback for USD/RUB only)
 *   - Derived → Urals India CIF, OPEC Basket
 *
 * Schedule: Every 30 min during market hours (Mon-Fri 06:00-22:00 UTC)
 */

import { supabaseAdmin, logPipelineStart, logPipelineEnd } from './supabase-admin.js'

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY
const TWELVE_DATA_BASE = 'https://api.twelvedata.com'

// Rate limit helper
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Trading Economics (scrape, no API key) ───────────────────

const TE_BASE = 'https://tradingeconomics.com'

// User agents to rotate through
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

interface TECommodityConfig {
  slug: string          // TE page path (e.g. '/commodity/brent-crude-oil')
  commodity: string     // Internal name (e.g. 'brent')
  currency: string
  unit: string
  minPrice: number      // Sanity check bounds
  maxPrice: number
}

const TE_COMMODITIES: TECommodityConfig[] = [
  { slug: '/commodity/brent-crude-oil', commodity: 'brent', currency: 'USD', unit: 'bbl', minPrice: 20, maxPrice: 250 },
  { slug: '/commodity/crude-oil', commodity: 'wti', currency: 'USD', unit: 'bbl', minPrice: 20, maxPrice: 250 },
  { slug: '/commodity/natural-gas', commodity: 'henry_hub', currency: 'USD', unit: 'MMBtu', minPrice: 0.5, maxPrice: 30 },
  { slug: '/commodity/eu-natural-gas', commodity: 'ttf', currency: 'EUR', unit: 'MWh', minPrice: 5, maxPrice: 500 },
  { slug: '/commodity/lng', commodity: 'jkm', currency: 'USD', unit: 'MMBtu', minPrice: 1, maxPrice: 100 },
  { slug: '/commodity/urals-oil', commodity: 'urals', currency: 'USD', unit: 'bbl', minPrice: 15, maxPrice: 250 },
]

const TE_USDRUB_SLUG = '/russia/currency'

interface TEPriceResult {
  price: number
  symbol: string
  name: string
  source: 'trading_economics'
}

async function fetchTEPrice(slug: string, minPrice: number, maxPrice: number): Promise<TEPriceResult | null> {
  try {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    const res = await fetch(`${TE_BASE}${slug}`, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // Extract price from JSON-LD "last" or "value" field embedded in page
    const lastMatch = html.match(/"last"\s*:\s*([\d.]+)/)
    const valueMatch = html.match(/"value"\s*:\s*([\d.]+)/)
    const priceStr = lastMatch?.[1] || valueMatch?.[1]
    if (!priceStr) throw new Error('No price data found in page')

    const price = Number(priceStr)
    if (isNaN(price) || price < minPrice || price > maxPrice) {
      throw new Error(`Price ${price} outside bounds [${minPrice}, ${maxPrice}]`)
    }

    // Extract symbol from TESymbol variable
    const symbolMatch = html.match(/TESymbol\s*=\s*'([^']+)'/)
    // Extract name from page title or description
    const nameMatch = html.match(/<title>([^<]+)<\/title>/)
    const name = nameMatch?.[1]?.split(' - ')[0]?.trim() || ''

    return {
      price: Number(price.toFixed(4)),
      symbol: symbolMatch?.[1] || '',
      name,
      source: 'trading_economics',
    }
  } catch (err) {
    console.error(`  [te] Failed to fetch ${slug}:`, err instanceof Error ? err.message : err)
    return null
  }
}

async function fetchTEExchangeRate(slug: string): Promise<{ rate: number; source: string } | null> {
  try {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    const res = await fetch(`${TE_BASE}${slug}`, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // Extract rate from JSON-LD "last" or "value" field
    const lastMatch = html.match(/"last"\s*:\s*([\d.]+)/)
    const valueMatch = html.match(/"value"\s*:\s*([\d.]+)/)
    const rateStr = lastMatch?.[1] || valueMatch?.[1]
    if (!rateStr) throw new Error('No rate data found in page')

    const rate = Number(rateStr)
    if (isNaN(rate) || rate < 10 || rate > 500) {
      throw new Error(`Rate ${rate} outside reasonable bounds`)
    }

    return { rate: Number(rate.toFixed(4)), source: 'trading_economics' }
  } catch (err) {
    console.error(`  [te] Failed to fetch FX ${slug}:`, err instanceof Error ? err.message : err)
    return null
  }
}

// Yahoo symbol mapping for fallback
const YAHOO_FALLBACK: Record<string, string> = {
  brent: 'BZ=F',
  wti: 'CL=F',
  henry_hub: 'NG=F',
  ttf: 'TTF=F',
  jkm: 'JKM=F',
}

// ─── Twelve Data (free tier) ───────────────────────────────

interface TwelveDataQuote {
  symbol: string
  close: string
  change: string
  percent_change: string
  datetime: string
}

interface TwelveDataTimeSeries {
  values: Array<{ datetime: string; close: string; open: string; high: string; low: string; volume: string }>
}

async function fetchTwelveDataQuote(symbol: string): Promise<TwelveDataQuote | null> {
  try {
    const res = await fetch(
      `${TWELVE_DATA_BASE}/quote?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.code) throw new Error(data.message || `API error ${data.code}`)
    return data
  } catch (err) {
    console.error(`  [twelve_data] Failed to fetch ${symbol}:`, err instanceof Error ? err.message : err)
    return null
  }
}

async function fetchTwelveDataSeries(symbol: string, days: number = 5): Promise<number[]> {
  try {
    const res = await fetch(
      `${TWELVE_DATA_BASE}/time_series?symbol=${symbol}&interval=1day&outputsize=${days}&apikey=${TWELVE_DATA_KEY}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: TwelveDataTimeSeries = await res.json()
    if (!data.values) return []
    return data.values.map((v) => parseFloat(v.close)).reverse()
  } catch (err) {
    console.error(`  [twelve_data] Failed to fetch sparkline for ${symbol}:`, err instanceof Error ? err.message : err)
    return []
  }
}

async function fetchTwelveDataHistory(symbol: string, days: number = 90): Promise<Array<{
  date: string; open: number; high: number; low: number; close: number; volume: number | null
}>> {
  try {
    const res = await fetch(
      `${TWELVE_DATA_BASE}/time_series?symbol=${symbol}&interval=1day&outputsize=${days}&apikey=${TWELVE_DATA_KEY}`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: TwelveDataTimeSeries = await res.json()
    if (!data.values) return []
    return data.values
      .map((v) => ({
        date: v.datetime.split(' ')[0],
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: v.volume ? parseInt(v.volume) : null,
      }))
      .reverse()
  } catch (err) {
    console.error(`  [twelve_data] Failed to fetch history for ${symbol}:`, err instanceof Error ? err.message : err)
    return []
  }
}

// ─── Yahoo Finance (free, no API key) ──────────────────────

interface YahooQuote {
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketTime: number
  symbol: string
}

async function fetchYahooQuoteViaChart(symbol: string): Promise<YahooQuote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } }
    )
    if (!res.ok) throw new Error(`Yahoo Chart HTTP ${res.status}`)
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta || !meta.regularMarketPrice) return null
    const price = Number(meta.regularMarketPrice)
    const prevClose = Number(meta.previousClose || meta.chartPreviousClose || price)
    const change = price - prevClose
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
    return {
      regularMarketPrice: price,
      regularMarketChange: Number(change.toFixed(2)),
      regularMarketChangePercent: Number(changePct.toFixed(2)),
      regularMarketTime: meta.regularMarketTime || Date.now() / 1000,
      symbol: meta.symbol || symbol,
    }
  } catch (err) {
    console.error(`  [yahoo] Failed to fetch ${symbol}:`, err instanceof Error ? err.message : err)
    return null
  }
}

async function fetchYahooHistory(symbol: string, days: number = 90): Promise<Array<{
  date: string; open: number; high: number; low: number; close: number; volume: number | null
}>> {
  try {
    const period2 = Math.floor(Date.now() / 1000)
    const period1 = period2 - (days * 86400)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`,
      { headers: { 'User-Agent': 'CrudeIntel/1.0' } }
    )
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`)
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return []

    const timestamps = result.timestamp || []
    const quotes = result.indicators?.quote?.[0] || {}
    return timestamps.map((t: number, i: number) => ({
      date: new Date(t * 1000).toISOString().split('T')[0],
      open: Number((quotes.open?.[i] || 0).toFixed(2)),
      high: Number((quotes.high?.[i] || 0).toFixed(2)),
      low: Number((quotes.low?.[i] || 0).toFixed(2)),
      close: Number((quotes.close?.[i] || 0).toFixed(2)),
      volume: quotes.volume?.[i] || null,
    })).filter((r: { close: number }) => r.close > 0)
  } catch (err) {
    console.error(`  [yahoo] Failed to fetch history for ${symbol}:`, err instanceof Error ? err.message : err)
    return []
  }
}

// ─── Urals price fetching ────────────────────────────────────
// Try to fetch real Urals price; fall back to Brent-based derivation
const URALS_FALLBACK_DISCOUNT = 14.0
const URALS_INDIA_FREIGHT = 10.0 // Estimated freight Russia → India ($/bbl)

// Urals DAP Europe: sanctions-driven discount that widens when Brent rises
// Feb 2026 data: Brent ~$65, Urals Europe ~$55 → discount ~$10
// Mar 2026 data: Brent ~$103, Urals Europe ~$65 → discount ~$38
function calcUralsDAPDiscount(brentPrice: number): number {
  return 8 + Math.max(0, (brentPrice - 60)) * 0.7
}

async function fetchUralsPrice(): Promise<{ price: number; source: string } | null> {
  // Try Investing.com Urals CFR spot via a known data endpoint
  try {
    const res = await fetch(
      'https://markets-data-api-proxy.ft.com/research/webservices/securities/v1/quotes?symbols=NYMEX:URL',
      { headers: { 'User-Agent': 'CrudeIntel/1.0' }, signal: AbortSignal.timeout(10000) }
    )
    if (res.ok) {
      const data = await res.json()
      const price = data?.data?.items?.[0]?.basic?.lastPrice
      if (price && price > 20 && price < 200) {
        return { price: Number(Number(price).toFixed(2)), source: 'ft_markets' }
      }
    }
  } catch { /* ignore */ }

  // Try cbonds/alternative sources — skip if unavailable
  return null
}

function deriveUrals(brentPrice: number, brentChange: number, brentChangePct: number, brentSparkline: number[], discount: number) {
  return {
    commodity: 'urals',
    price: Number((brentPrice - discount).toFixed(2)),
    change: Number(brentChange.toFixed(2)),
    change_pct: Number(brentChangePct.toFixed(2)),
    currency: 'USD',
    unit: 'bbl',
    source: 'derived',
    sparkline_5d: brentSparkline.map((p) => Number((p - discount).toFixed(2))),
    discount_from_brent: discount,
    discount_source: 'calculated',
    discount_updated: new Date().toISOString().split('T')[0],
  }
}

// ─── Main ───────────────────────────────────────────────────
export async function run() {
  const runId = await logPipelineStart('prices')
  const errors: string[] = []

  // Track fetched prices for derived commodities
  const livePrices: Record<string, { price: number; change: number; change_pct: number; source: string }> = {}

  try {
    // ── Step 1: Fetch current prices from Trading Economics (primary) ──
    console.log('  [Step 1] Fetching current prices from Trading Economics...')
    for (const cfg of TE_COMMODITIES) {
      console.log(`  Fetching ${cfg.commodity} from Trading Economics...`)
      const te = await fetchTEPrice(cfg.slug, cfg.minPrice, cfg.maxPrice)

      if (te) {
        livePrices[cfg.commodity] = { price: te.price, change: 0, change_pct: 0, source: 'trading_economics' }
        console.log(`  ✓ ${cfg.commodity} (TE): ${cfg.currency === 'EUR' ? '€' : '$'}${te.price}`)
      } else {
        // Fallback to Yahoo Finance live quote
        const yahooSymbol = YAHOO_FALLBACK[cfg.commodity]
        if (yahooSymbol) {
          console.log(`  ⚠ TE failed for ${cfg.commodity}, trying Yahoo Finance (${yahooSymbol})...`)
          const yahoo = await fetchYahooQuoteViaChart(yahooSymbol)
          if (yahoo) {
            livePrices[cfg.commodity] = {
              price: Number(yahoo.regularMarketPrice.toFixed(4)),
              change: Number(yahoo.regularMarketChange.toFixed(4)),
              change_pct: Number(yahoo.regularMarketChangePercent.toFixed(2)),
              source: 'yahoo_finance',
            }
            console.log(`  ✓ ${cfg.commodity} (Yahoo fallback): ${cfg.currency === 'EUR' ? '€' : '$'}${yahoo.regularMarketPrice.toFixed(2)}`)
          } else {
            errors.push(`No quote for ${cfg.commodity} from TE or Yahoo`)
          }
        } else if (cfg.commodity === 'urals') {
          // Urals has its own fallback chain handled below
          console.log(`  ⚠ TE failed for Urals — will try FT Markets / derived fallback`)
        }
      }

      // Rate limit between TE requests
      await delay(2000)
    }

    // ── Step 2: USD/RUB exchange rate (TE primary, Twelve Data fallback) ──
    console.log('  Fetching USD/RUB from Trading Economics...')
    const teFx = await fetchTEExchangeRate(TE_USDRUB_SLUG)
    if (teFx) {
      await supabaseAdmin.from('exchange_rates').upsert({
        pair: 'USD/RUB',
        rate: teFx.rate,
        change_pct: 0,
      }, { onConflict: 'pair' })
      console.log(`  ✓ USD/RUB (TE): ${teFx.rate}`)
    } else if (TWELVE_DATA_KEY) {
      console.log('  ⚠ TE failed for USD/RUB, trying Twelve Data fallback...')
      const fxQuote = await fetchTwelveDataQuote('USD/RUB')
      if (fxQuote) {
        await supabaseAdmin.from('exchange_rates').upsert({
          pair: 'USD/RUB',
          rate: parseFloat(fxQuote.close),
          change_pct: parseFloat(fxQuote.percent_change),
        }, { onConflict: 'pair' })
        console.log(`  ✓ USD/RUB (Twelve Data fallback): ${fxQuote.close}`)
      }
    }

    // ── Step 3: Urals fallback chain (if TE didn't get it) ──
    let uralsDiscount = URALS_FALLBACK_DISCOUNT
    const brentLive = livePrices['brent']

    if (!livePrices['urals'] && brentLive) {
      // Fallback 1: FT Markets
      console.log('  Trying FT Markets for Urals...')
      const ftUrals = await fetchUralsPrice()
      if (ftUrals) {
        livePrices['urals'] = { price: ftUrals.price, change: 0, change_pct: 0, source: ftUrals.source }
        console.log(`  ✓ Urals (FT Markets): $${ftUrals.price}`)
      } else {
        // Fallback 2: Derive from Brent
        const discount = calcUralsDAPDiscount(brentLive.price)
        const derivedPrice = Number((brentLive.price - discount).toFixed(2))
        livePrices['urals'] = { price: derivedPrice, change: brentLive.change, change_pct: brentLive.change_pct, source: 'derived' }
        console.log(`  ✓ Urals (derived, $${discount.toFixed(2)} discount): $${derivedPrice}`)
      }
    }

    // Calculate Urals discount from Brent (for history derivation)
    if (livePrices['urals'] && brentLive) {
      uralsDiscount = Number((brentLive.price - livePrices['urals'].price).toFixed(2))
    }

    // ── Step 4: Upsert all current prices to Supabase ──
    console.log('  [Step 4] Upserting current prices to Supabase...')
    for (const cfg of TE_COMMODITIES) {
      const live = livePrices[cfg.commodity]
      if (!live) continue

      const upsertData: Record<string, unknown> = {
        commodity: cfg.commodity,
        price: live.price,
        change: live.change,
        change_pct: live.change_pct,
        currency: cfg.currency,
        unit: cfg.unit,
        source: live.source,
        sparkline_5d: [], // Will be updated from history below
      }

      // Add Urals-specific fields
      if (cfg.commodity === 'urals' && brentLive) {
        upsertData.discount_from_brent = uralsDiscount
        upsertData.discount_source = live.source === 'trading_economics' ? 'live' : (live.source === 'derived' ? 'calculated' : 'live')
        upsertData.discount_updated = new Date().toISOString().split('T')[0]
      }

      const { error } = await supabaseAdmin.from('prices').upsert(upsertData, { onConflict: 'commodity' })
      if (error) errors.push(`${cfg.commodity}: ${error.message}`)
    }

    // ── Step 5: OPEC Basket (derived from Brent) ──
    if (brentLive) {
      const opecPrice = Number((brentLive.price - 2.3).toFixed(2))
      await supabaseAdmin.from('prices').upsert({
        commodity: 'opec_basket',
        price: opecPrice,
        change: 0,
        change_pct: brentLive.change_pct,
        currency: 'USD',
        unit: 'bbl',
        source: 'derived',
        sparkline_5d: [],
      }, { onConflict: 'commodity' })
      console.log(`  ✓ OPEC Basket (derived): $${opecPrice}`)
    }

    // ── Step 6: Price history for ALL commodities (Yahoo Finance) ──
    console.log('  [Step 6] Fetching price history from Yahoo Finance...')

    // History config: commodity → { yahoo symbol, days }
    const historyConfig: Array<{ commodity: string; symbol: string; days: number }> = [
      { commodity: 'brent', symbol: 'BZ=F', days: 365 },
      { commodity: 'wti', symbol: 'CL=F', days: 365 },
      { commodity: 'henry_hub', symbol: 'NG=F', days: 253 },
      { commodity: 'ttf', symbol: 'TTF=F', days: 90 },
      { commodity: 'jkm', symbol: 'JKM=F', days: 365 },
    ]

    const histories: Record<string, Array<{ date: string; open: number; high: number; low: number; close: number; volume: number | null }>> = {}

    for (const cfg of historyConfig) {
      console.log(`  Fetching ${cfg.commodity} price history...`)
      const history = await fetchYahooHistory(cfg.symbol, cfg.days)
      if (history.length) {
        histories[cfg.commodity] = history
        const rows = history.map((h) => ({ commodity: cfg.commodity, ...h }))
        const { error } = await supabaseAdmin
          .from('price_history')
          .upsert(rows, { onConflict: 'commodity,date' })
        if (error) errors.push(`price_history ${cfg.commodity}: ${error.message}`)
        else console.log(`  ✓ ${cfg.commodity} history: ${history.length} days`)

        // Update sparkline from history
        await supabaseAdmin.from('prices').update({
          sparkline_5d: history.slice(-5).map((h) => h.close),
        }).eq('commodity', cfg.commodity)

        // For JKM: also update price from history if no live quote succeeded
        if (cfg.commodity === 'jkm' && !livePrices['jkm']) {
          const latest = history[history.length - 1]
          const prev = history.length > 1 ? history[history.length - 2] : latest
          const change = Number((latest.close - prev.close).toFixed(3))
          const changePct = prev.close > 0 ? Number(((change / prev.close) * 100).toFixed(2)) : 0
          await supabaseAdmin.from('prices').upsert({
            commodity: 'jkm',
            price: latest.close,
            change,
            change_pct: changePct,
            currency: 'USD',
            unit: 'MMBtu',
            source: 'yahoo_finance',
            sparkline_5d: history.slice(-5).map((h) => h.close),
          }, { onConflict: 'commodity' })
          console.log(`  ✓ JKM price updated from history: $${latest.close}`)
        }
      }
    }

    // 6b. Urals history (derived from Brent history)
    const brentHistory = histories['brent']
    if (brentHistory?.length) {
      const uralsHistory = brentHistory.map((h) => ({
        commodity: 'urals',
        date: h.date,
        open: Number((h.open - uralsDiscount).toFixed(2)),
        high: Number((h.high - uralsDiscount).toFixed(2)),
        low: Number((h.low - uralsDiscount).toFixed(2)),
        close: Number((h.close - uralsDiscount).toFixed(2)),
        volume: h.volume,
      }))
      const { error } = await supabaseAdmin
        .from('price_history')
        .upsert(uralsHistory, { onConflict: 'commodity,date' })
      if (error) errors.push(`price_history urals: ${error.message}`)
      else console.log(`  ✓ Urals history: ${uralsHistory.length} days (derived from Brent)`)

      // Update Urals sparkline
      await supabaseAdmin.from('prices').update({
        sparkline_5d: uralsHistory.slice(-5).map((h) => h.close),
      }).eq('commodity', 'urals')

      // 6c. Urals India CIF history (Urals FOB + freight)
      const uralsIndiaHistory = brentHistory.map((h) => ({
        commodity: 'urals_india',
        date: h.date,
        open: Number((h.open - uralsDiscount + URALS_INDIA_FREIGHT).toFixed(2)),
        high: Number((h.high - uralsDiscount + URALS_INDIA_FREIGHT).toFixed(2)),
        low: Number((h.low - uralsDiscount + URALS_INDIA_FREIGHT).toFixed(2)),
        close: Number((h.close - uralsDiscount + URALS_INDIA_FREIGHT).toFixed(2)),
        volume: null,
      }))
      const { error: uie } = await supabaseAdmin
        .from('price_history')
        .upsert(uralsIndiaHistory, { onConflict: 'commodity,date' })
      if (uie) errors.push(`price_history urals_india: ${uie.message}`)
      else console.log(`  ✓ Urals India history: ${uralsIndiaHistory.length} days (derived)`)

      // Upsert Urals India current price
      const latestIndiaPrice = uralsIndiaHistory[uralsIndiaHistory.length - 1].close
      await supabaseAdmin.from('prices').upsert({
        commodity: 'urals_india',
        price: latestIndiaPrice,
        change: livePrices['urals']?.change || 0,
        change_pct: livePrices['urals']?.change_pct || 0,
        currency: 'USD',
        unit: 'bbl',
        source: 'derived',
        sparkline_5d: uralsIndiaHistory.slice(-5).map((h) => h.close),
      }, { onConflict: 'commodity' })
      console.log(`  ✓ Urals India CIF: $${latestIndiaPrice}`)
    }

    const status = errors.length === 0 ? 'success' : 'partial'
    console.log(`  [prices] ${status} — ${errors.length} errors`)
    if (errors.length) console.error('  Errors:', errors.join('; '))
    await logPipelineEnd(runId, status, errors.join('; '))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  [prices] FAILED:`, msg)
    await logPipelineEnd(runId, 'failed', msg)
  }
}

// Run if called directly
if (process.argv[1]?.endsWith('fetch-prices.ts') || process.argv[1]?.endsWith('fetch-prices.js')) {
  import('dotenv/config').then(() => run().then(() => process.exit(0)))
}
