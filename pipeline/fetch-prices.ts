/**
 * Pipeline: Fetch commodity prices from multiple free sources
 *
 * Sources:
 *   - Yahoo Finance (primary, no key) → Brent, WTI, Henry Hub, TTF, JKM LNG
 *   - Trading Economics (scrape, for Urals only) → Urals (real OTC price)
 *   - Wise API (free, no key) → USD/RUB
 *   - Derived → Urals India CIF (Urals + freight), OPEC Basket (Brent - $2.30)
 *
 * Urals: TE scrape works from residential IPs (local runs).
 *        On server/CI (GitHub Actions), falls back to FT Markets or last known price.
 *        Set USE_TE_URALS=true in .env to enable TE scraping for Urals.
 *
 * Schedule: Every 30 min during market hours (Mon-Fri 06:00-22:00 UTC)
 */

import { supabaseAdmin, logPipelineStart, logPipelineEnd } from './supabase-admin.js'

// Rate limit helper
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Whether to attempt TE scraping for Urals (works from residential IPs only)
const USE_TE_URALS = process.env.USE_TE_URALS === 'true'

// Fallback Urals discount from Brent (used only as absolute last resort)
const URALS_FALLBACK_DISCOUNT = 3.0 // Based on TE data: Brent $112.75, Urals $109.69 → ~$3 discount
const URALS_INDIA_FREIGHT = 10.0 // Estimated freight Russia → India ($/bbl)

// ─── Trading Economics (scrape, Urals only) ──────────────────

async function fetchTEUrals(): Promise<{ price: number; source: string } | null> {
  if (!USE_TE_URALS) return null

  try {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    const res = await fetch('https://tradingeconomics.com/commodity/urals-oil', {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // Extract price from JSON-LD "last" or "value" field
    const lastMatch = html.match(/"last"\s*:\s*([\d.]+)/)
    const valueMatch = html.match(/"value"\s*:\s*([\d.]+)/)
    const priceStr = lastMatch?.[1] || valueMatch?.[1]
    if (!priceStr) throw new Error('No price data found in page')

    const price = Number(priceStr)
    if (isNaN(price) || price < 15 || price > 250) {
      throw new Error(`Price ${price} outside bounds [15, 250]`)
    }

    return { price: Number(price.toFixed(2)), source: 'trading_economics' }
  } catch (err) {
    console.error(`  [te] Failed to fetch Urals:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── FT Markets (Urals fallback) ─────────────────────────────

async function fetchFTUrals(): Promise<{ price: number; source: string } | null> {
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
  return null
}

// ─── Wise API (USD/RUB, free, no key) ────────────────────────

async function fetchWiseUSDRUB(): Promise<{ rate: number; source: string } | null> {
  try {
    const res = await fetch('https://wise.com/rates/live?source=USD&target=RUB', {
      headers: { 'User-Agent': 'CrudeIntel/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.value && data.value > 10 && data.value < 500) {
      return { rate: Number(Number(data.value).toFixed(4)), source: 'wise' }
    }
    return null
  } catch (err) {
    console.error(`  [wise] Failed to fetch USD/RUB:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Yahoo Finance (primary, free, no API key) ──────────────

interface YahooQuote {
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketTime: number
  symbol: string
}

async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
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

// ─── Main ───────────────────────────────────────────────────
export async function run() {
  const runId = await logPipelineStart('prices')
  const errors: string[] = []

  try {
    // ── Step 1: Fetch commodity prices from Yahoo Finance (primary) ──
    console.log('  [Step 1] Fetching commodity prices from Yahoo Finance...')

    const commodities: Array<{
      name: string; symbol: string; currency: string; unit: string; decimals: number
    }> = [
      { name: 'brent', symbol: 'BZ=F', currency: 'USD', unit: 'bbl', decimals: 2 },
      { name: 'wti', symbol: 'CL=F', currency: 'USD', unit: 'bbl', decimals: 2 },
      { name: 'henry_hub', symbol: 'NG=F', currency: 'USD', unit: 'MMBtu', decimals: 3 },
      { name: 'ttf', symbol: 'TTF=F', currency: 'EUR', unit: 'MWh', decimals: 2 },
      { name: 'jkm', symbol: 'JKM=F', currency: 'USD', unit: 'MMBtu', decimals: 3 },
    ]

    const livePrices: Record<string, { price: number; change: number; change_pct: number; source: string }> = {}

    for (const c of commodities) {
      console.log(`  Fetching ${c.name} (${c.symbol})...`)
      const quote = await fetchYahooQuote(c.symbol)
      if (quote) {
        livePrices[c.name] = {
          price: Number(quote.regularMarketPrice.toFixed(c.decimals)),
          change: Number(quote.regularMarketChange.toFixed(c.decimals)),
          change_pct: Number(quote.regularMarketChangePercent.toFixed(2)),
          source: 'yahoo_finance',
        }
        const sym = c.currency === 'EUR' ? '€' : '$'
        console.log(`  ✓ ${c.name}: ${sym}${quote.regularMarketPrice.toFixed(c.decimals)}`)
      } else {
        errors.push(`No ${c.name} quote from Yahoo`)
      }
    }

    // JKM fallback: if live quote returns 0, try history
    if (!livePrices['jkm'] || livePrices['jkm'].price === 0) {
      console.log('  ⚠ JKM live quote unavailable, trying history fallback...')
      const jkmHist = await fetchYahooHistory('JKM=F', 10)
      if (jkmHist.length) {
        const latest = jkmHist[jkmHist.length - 1]
        const prev = jkmHist.length > 1 ? jkmHist[jkmHist.length - 2] : latest
        const change = Number((latest.close - prev.close).toFixed(3))
        const changePct = prev.close > 0 ? Number(((change / prev.close) * 100).toFixed(2)) : 0
        livePrices['jkm'] = { price: latest.close, change, change_pct: changePct, source: 'yahoo_finance' }
        console.log(`  ✓ JKM (history fallback): $${latest.close}`)
      }
    }

    // ── Step 2: Urals — TE (local) → FT Markets → Brent minus fixed discount ──
    console.log('  [Step 2] Fetching Urals price...')
    let uralsDiscount = URALS_FALLBACK_DISCOUNT
    const brentLive = livePrices['brent']

    // Try 1: Trading Economics (only if USE_TE_URALS=true, works from residential IPs)
    const teUrals = await fetchTEUrals()
    if (teUrals) {
      livePrices['urals'] = { price: teUrals.price, change: 0, change_pct: 0, source: 'trading_economics' }
      if (brentLive) uralsDiscount = Number((brentLive.price - teUrals.price).toFixed(2))
      console.log(`  ✓ Urals (TE): $${teUrals.price}`)
    }

    // Try 2: FT Markets
    if (!livePrices['urals']) {
      const ftUrals = await fetchFTUrals()
      if (ftUrals) {
        livePrices['urals'] = { price: ftUrals.price, change: 0, change_pct: 0, source: 'ft_markets' }
        if (brentLive) uralsDiscount = Number((brentLive.price - ftUrals.price).toFixed(2))
        console.log(`  ✓ Urals (FT Markets): $${ftUrals.price}`)
      }
    }

    // Try 3: Derive from Brent using fixed small discount (~$3)
    if (!livePrices['urals'] && brentLive) {
      const derivedPrice = Number((brentLive.price - URALS_FALLBACK_DISCOUNT).toFixed(2))
      livePrices['urals'] = {
        price: derivedPrice,
        change: brentLive.change,
        change_pct: brentLive.change_pct,
        source: 'derived',
      }
      uralsDiscount = URALS_FALLBACK_DISCOUNT
      console.log(`  ✓ Urals (Brent - $${URALS_FALLBACK_DISCOUNT} fallback): $${derivedPrice}`)
    }

    // ── Step 3: Upsert all current prices to Supabase ──
    console.log('  [Step 3] Upserting current prices...')
    for (const c of commodities) {
      const live = livePrices[c.name]
      if (!live) continue
      const { error } = await supabaseAdmin.from('prices').upsert({
        commodity: c.name,
        price: live.price,
        change: live.change,
        change_pct: live.change_pct,
        currency: c.currency,
        unit: c.unit,
        source: live.source,
        sparkline_5d: [],
      }, { onConflict: 'commodity' })
      if (error) errors.push(`${c.name}: ${error.message}`)
    }

    // Urals
    if (livePrices['urals']) {
      const u = livePrices['urals']
      const { error } = await supabaseAdmin.from('prices').upsert({
        commodity: 'urals',
        price: u.price,
        change: u.change,
        change_pct: u.change_pct,
        currency: 'USD',
        unit: 'bbl',
        source: u.source,
        sparkline_5d: [],
        discount_from_brent: uralsDiscount,
        discount_source: u.source === 'trading_economics' ? 'live' : (u.source === 'derived' ? 'calculated' : 'live'),
        discount_updated: new Date().toISOString().split('T')[0],
      }, { onConflict: 'commodity' })
      if (error) errors.push(`urals: ${error.message}`)
    }

    // OPEC Basket (derived from Brent)
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

    // ── Step 4: USD/RUB exchange rate (Wise primary) ──
    console.log('  [Step 4] Fetching USD/RUB...')
    const wiseFx = await fetchWiseUSDRUB()
    if (wiseFx) {
      await supabaseAdmin.from('exchange_rates').upsert({
        pair: 'USD/RUB',
        rate: wiseFx.rate,
        change_pct: 0,
      }, { onConflict: 'pair' })
      console.log(`  ✓ USD/RUB (Wise): ${wiseFx.rate}`)
    } else {
      console.warn('  ⚠ USD/RUB not available')
    }

    // ── Step 5: Price history for ALL commodities (Yahoo Finance) ──
    console.log('  [Step 5] Fetching price history from Yahoo Finance...')

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

        // JKM: update price from history if live quote failed
        if (cfg.commodity === 'jkm' && (!livePrices['jkm'] || livePrices['jkm'].price === 0)) {
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

    // Urals history (derived from Brent - discount)
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
      else console.log(`  ✓ Urals history: ${uralsHistory.length} days (Brent - $${uralsDiscount})`)

      // Update Urals sparkline
      await supabaseAdmin.from('prices').update({
        sparkline_5d: uralsHistory.slice(-5).map((h) => h.close),
      }).eq('commodity', 'urals')

      // Urals India CIF history (Urals + freight)
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
