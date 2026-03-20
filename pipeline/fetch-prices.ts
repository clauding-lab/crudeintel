/**
 * Pipeline: Fetch commodity prices from multiple free APIs
 *
 * Sources:
 *   - Yahoo Finance (no key) → Brent (BZ=F), Henry Hub (NG=F), TTF (TTF=F), JKM LNG (JKM=F)
 *   - Twelve Data API (free tier) → USD/RUB
 *   - Derived → Urals (Brent minus discount), OPEC Basket
 *
 * Schedule: Every 30 min during market hours (Mon-Fri 06:00-22:00 UTC)
 */

import { supabaseAdmin, logPipelineStart, logPipelineEnd } from './supabase-admin.js'

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY
const TWELVE_DATA_BASE = 'https://api.twelvedata.com'

// Rate limit helper
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

  try {
    // ── Step 1: Fetch from Yahoo Finance chart API (Brent + TTF) ──
    console.log('  Fetching Brent from Yahoo Finance...')
    const brentYahoo = await fetchYahooQuoteViaChart('BZ=F')

    console.log('  Fetching TTF from Yahoo Finance...')
    const ttfYahoo = await fetchYahooQuoteViaChart('TTF=F')

    if (brentYahoo) {
      const brentSparkline = await fetchYahooHistory('BZ=F', 7)
      const sparkline5d = brentSparkline.slice(-5).map((h) => h.close)

      const { error } = await supabaseAdmin.from('prices').upsert({
        commodity: 'brent',
        price: Number(brentYahoo.regularMarketPrice.toFixed(2)),
        change: Number(brentYahoo.regularMarketChange.toFixed(2)),
        change_pct: Number(brentYahoo.regularMarketChangePercent.toFixed(2)),
        currency: 'USD',
        unit: 'bbl',
        source: 'yahoo_finance',
        sparkline_5d: sparkline5d,
      }, { onConflict: 'commodity' })
      if (error) errors.push(`brent: ${error.message}`)
      else console.log(`  ✓ Brent: $${brentYahoo.regularMarketPrice.toFixed(2)}`)
    } else {
      errors.push('No Brent quote from Yahoo')
    }

    if (ttfYahoo) {
      const ttfSparklineHistory = await fetchYahooHistory('TTF=F', 7)
      const ttfSparkline5d = ttfSparklineHistory.slice(-5).map((h) => h.close)

      const { error } = await supabaseAdmin.from('prices').upsert({
        commodity: 'ttf',
        price: Number(ttfYahoo.regularMarketPrice.toFixed(2)),
        change: Number(ttfYahoo.regularMarketChange.toFixed(2)),
        change_pct: Number(ttfYahoo.regularMarketChangePercent.toFixed(2)),
        currency: 'EUR',
        unit: 'MWh',
        source: 'yahoo_finance',
        sparkline_5d: ttfSparkline5d,
      }, { onConflict: 'commodity' })
      if (error) errors.push(`ttf: ${error.message}`)
      else console.log(`  ✓ TTF: €${ttfYahoo.regularMarketPrice.toFixed(2)}`)
    } else {
      console.warn('  ⚠ TTF not available on Yahoo — keeping existing data')
    }

    // ── Step 1b: JKM LNG from Yahoo Finance ──
    console.log('  Fetching JKM LNG from Yahoo Finance...')
    const jkmYahoo = await fetchYahooQuoteViaChart('JKM=F')

    if (jkmYahoo) {
      const jkmSparklineHistory = await fetchYahooHistory('JKM=F', 7)
      const jkmSparkline5d = jkmSparklineHistory.slice(-5).map((h) => h.close)

      const { error } = await supabaseAdmin.from('prices').upsert({
        commodity: 'jkm',
        price: Number(jkmYahoo.regularMarketPrice.toFixed(3)),
        change: Number(jkmYahoo.regularMarketChange.toFixed(3)),
        change_pct: Number(jkmYahoo.regularMarketChangePercent.toFixed(2)),
        currency: 'USD',
        unit: 'MMBtu',
        source: 'yahoo_finance',
        sparkline_5d: jkmSparkline5d,
      }, { onConflict: 'commodity' })
      if (error) errors.push(`jkm: ${error.message}`)
      else console.log(`  ✓ JKM LNG: $${jkmYahoo.regularMarketPrice.toFixed(3)}`)
    } else {
      // JKM may not have regularMarketPrice — try history fallback
      console.log('  ⚠ JKM live quote unavailable, trying history fallback...')
      const jkmHistory = await fetchYahooHistory('JKM=F', 10)
      if (jkmHistory.length) {
        const latest = jkmHistory[jkmHistory.length - 1]
        const prev = jkmHistory.length > 1 ? jkmHistory[jkmHistory.length - 2] : latest
        const change = Number((latest.close - prev.close).toFixed(3))
        const changePct = prev.close > 0 ? Number(((change / prev.close) * 100).toFixed(2)) : 0
        const { error } = await supabaseAdmin.from('prices').upsert({
          commodity: 'jkm',
          price: latest.close,
          change,
          change_pct: changePct,
          currency: 'USD',
          unit: 'MMBtu',
          source: 'yahoo_finance',
          sparkline_5d: jkmHistory.slice(-5).map((h) => h.close),
        }, { onConflict: 'commodity' })
        if (error) errors.push(`jkm: ${error.message}`)
        else console.log(`  ✓ JKM LNG (from history): $${latest.close}`)
      } else {
        console.warn('  ⚠ JKM LNG not available')
      }
    }

    // ── Step 2: Fetch WTI + Henry Hub from Yahoo Finance ──
    console.log('  Fetching WTI from Yahoo Finance...')
    const wtiYahoo = await fetchYahooQuoteViaChart('CL=F')

    if (wtiYahoo) {
      const wtiSparklineHistory = await fetchYahooHistory('CL=F', 7)
      const wtiSparkline5d = wtiSparklineHistory.slice(-5).map((h) => h.close)

      const { error } = await supabaseAdmin.from('prices').upsert({
        commodity: 'wti',
        price: Number(wtiYahoo.regularMarketPrice.toFixed(2)),
        change: Number(wtiYahoo.regularMarketChange.toFixed(2)),
        change_pct: Number(wtiYahoo.regularMarketChangePercent.toFixed(2)),
        currency: 'USD',
        unit: 'bbl',
        source: 'yahoo_finance',
        sparkline_5d: wtiSparkline5d,
      }, { onConflict: 'commodity' })
      if (error) errors.push(`wti: ${error.message}`)
      else console.log(`  ✓ WTI: $${wtiYahoo.regularMarketPrice.toFixed(2)}`)
    } else {
      errors.push('No WTI quote from Yahoo Finance')
    }

    console.log('  Fetching Henry Hub from Yahoo Finance...')
    const ngYahoo = await fetchYahooQuoteViaChart('NG=F')

    if (ngYahoo) {
      const ngSparklineHistory = await fetchYahooHistory('NG=F', 7)
      const ngSparkline5d = ngSparklineHistory.slice(-5).map((h) => h.close)

      const { error } = await supabaseAdmin.from('prices').upsert({
        commodity: 'henry_hub',
        price: Number(ngYahoo.regularMarketPrice.toFixed(3)),
        change: Number(ngYahoo.regularMarketChange.toFixed(3)),
        change_pct: Number(ngYahoo.regularMarketChangePercent.toFixed(2)),
        currency: 'USD',
        unit: 'MMBtu',
        source: 'yahoo_finance',
        sparkline_5d: ngSparkline5d,
      }, { onConflict: 'commodity' })
      if (error) errors.push(`henry_hub: ${error.message}`)
      else console.log(`  ✓ Henry Hub: $${ngYahoo.regularMarketPrice.toFixed(3)}`)
    } else {
      errors.push('No Henry Hub quote from Yahoo Finance')
    }

    // ── Step 3: USD/RUB exchange rate ──
    console.log('  Fetching USD/RUB from Twelve Data...')
    const fxQuote = await fetchTwelveDataQuote('USD/RUB')
    if (fxQuote) {
      await supabaseAdmin.from('exchange_rates').upsert({
        pair: 'USD/RUB',
        rate: parseFloat(fxQuote.close),
        change_pct: parseFloat(fxQuote.percent_change),
      }, { onConflict: 'pair' })
      console.log(`  ✓ USD/RUB: ${fxQuote.close}`)
    }

    // ── Step 4: Urals — try real price, fall back to Brent-based derivation ──
    let uralsDiscount = URALS_FALLBACK_DISCOUNT
    if (brentYahoo) {
      console.log('  Fetching Urals price...')
      const realUrals = await fetchUralsPrice()
      const brentSparkline5d = (await fetchYahooHistory('BZ=F', 7)).slice(-5).map((h) => h.close)

      if (realUrals) {
        // Use real Urals price and calculate actual discount
        uralsDiscount = Number((brentYahoo.regularMarketPrice - realUrals.price).toFixed(2))
        console.log(`  ✓ Urals (live): $${realUrals.price} — discount from Brent: $${uralsDiscount}`)
        const { error } = await supabaseAdmin.from('prices').upsert({
          commodity: 'urals',
          price: realUrals.price,
          change: Number(brentYahoo.regularMarketChange.toFixed(2)),
          change_pct: Number(brentYahoo.regularMarketChangePercent.toFixed(2)),
          currency: 'USD',
          unit: 'bbl',
          source: realUrals.source,
          sparkline_5d: brentSparkline5d.map((p) => Number((p - uralsDiscount).toFixed(2))),
          discount_from_brent: uralsDiscount,
          discount_source: 'live',
          discount_updated: new Date().toISOString().split('T')[0],
        }, { onConflict: 'commodity' })
        if (error) errors.push(`urals: ${error.message}`)
      } else {
        // Fall back to derived
        const urals = deriveUrals(
          brentYahoo.regularMarketPrice,
          brentYahoo.regularMarketChange,
          brentYahoo.regularMarketChangePercent,
          brentSparkline5d,
          uralsDiscount,
        )
        const { error } = await supabaseAdmin.from('prices').upsert(urals, { onConflict: 'commodity' })
        if (error) errors.push(`urals: ${error.message}`)
        else console.log(`  ✓ Urals (derived, $${uralsDiscount} discount): $${urals.price}`)
      }
    }

    // ── Step 5: OPEC Basket (derived from Brent) ──
    if (brentYahoo) {
      const opecPrice = Number((brentYahoo.regularMarketPrice - 2.3).toFixed(2))
      await supabaseAdmin.from('prices').upsert({
        commodity: 'opec_basket',
        price: opecPrice,
        change: 0,
        change_pct: Number(brentYahoo.regularMarketChangePercent.toFixed(2)),
        currency: 'USD',
        unit: 'bbl',
        source: 'derived',
        sparkline_5d: [],
      }, { onConflict: 'commodity' })
      console.log(`  ✓ OPEC Basket (derived): $${opecPrice}`)
    }

    // (Step 6 — spreads table — moved after Step 7f so we can use computed history)

    // ── Step 7: Price history for ALL commodities ──

    // 7a. Brent (Yahoo Finance)
    console.log('  Fetching Brent price history...')
    const brentHistory = await fetchYahooHistory('BZ=F', 365)
    if (brentHistory.length) {
      const rows = brentHistory.map((h) => ({ commodity: 'brent', ...h }))
      const { error } = await supabaseAdmin
        .from('price_history')
        .upsert(rows, { onConflict: 'commodity,date' })
      if (error) errors.push(`price_history brent: ${error.message}`)
      else console.log(`  ✓ Brent history: ${brentHistory.length} days`)

      // Update sparkline from history (live price already set in Step 1)
      if (brentYahoo) {
        await supabaseAdmin.from('prices').update({
          sparkline_5d: brentHistory.slice(-5).map((h) => h.close),
        }).eq('commodity', 'brent')
      }

      // 7b. Urals (derived from Brent — dynamic discount)
      const uralsHistory = brentHistory.map((h) => ({
        commodity: 'urals',
        date: h.date,
        open: Number((h.open - uralsDiscount).toFixed(2)),
        high: Number((h.high - uralsDiscount).toFixed(2)),
        low: Number((h.low - uralsDiscount).toFixed(2)),
        close: Number((h.close - uralsDiscount).toFixed(2)),
        volume: h.volume,
      }))
      const { error: ue } = await supabaseAdmin
        .from('price_history')
        .upsert(uralsHistory, { onConflict: 'commodity,date' })
      if (ue) errors.push(`price_history urals: ${ue.message}`)
      else console.log(`  ✓ Urals history: ${uralsHistory.length} days (derived)`)
    }

    // 7c. Henry Hub / Natural Gas (Yahoo Finance)
    console.log('  Fetching Henry Hub price history...')
    const ngHistory = await fetchYahooHistory('NG=F', 253)
    if (ngHistory.length) {
      const rows = ngHistory.map((h) => ({ commodity: 'henry_hub', ...h }))
      const { error } = await supabaseAdmin
        .from('price_history')
        .upsert(rows, { onConflict: 'commodity,date' })
      if (error) errors.push(`price_history henry_hub: ${error.message}`)
      else console.log(`  ✓ Henry Hub history: ${ngHistory.length} days`)

      // Update sparkline from history (live price already set in Step 2)
      if (ngYahoo) {
        await supabaseAdmin.from('prices').update({
          sparkline_5d: ngHistory.slice(-5).map((h) => h.close),
        }).eq('commodity', 'henry_hub')
      }
    }

    // 7d. WTI (Yahoo Finance)
    console.log('  Fetching WTI price history...')
    const wtiHistory = await fetchYahooHistory('CL=F', 365)
    if (wtiHistory.length) {
      const rows = wtiHistory.map((h) => ({ commodity: 'wti', ...h }))
      const { error } = await supabaseAdmin
        .from('price_history')
        .upsert(rows, { onConflict: 'commodity,date' })
      if (error) errors.push(`price_history wti: ${error.message}`)
      else console.log(`  ✓ WTI history: ${wtiHistory.length} days`)
    }

    // 7e. TTF (Yahoo Finance)
    console.log('  Fetching TTF price history...')
    const ttfHistory = await fetchYahooHistory('TTF=F', 90)
    if (ttfHistory.length) {
      const rows = ttfHistory.map((h) => ({ commodity: 'ttf', ...h }))
      const { error } = await supabaseAdmin
        .from('price_history')
        .upsert(rows, { onConflict: 'commodity,date' })
      if (error) errors.push(`price_history ttf: ${error.message}`)
      else console.log(`  ✓ TTF history: ${ttfHistory.length} days`)
    }

    // 7f. JKM LNG (Yahoo Finance)
    console.log('  Fetching JKM LNG price history...')
    const jkmHistory = await fetchYahooHistory('JKM=F', 365)
    if (jkmHistory.length) {
      const rows = jkmHistory.map((h) => ({ commodity: 'jkm', ...h }))
      const { error } = await supabaseAdmin
        .from('price_history')
        .upsert(rows, { onConflict: 'commodity,date' })
      if (error) errors.push(`price_history jkm: ${error.message}`)
      else console.log(`  ✓ JKM LNG history: ${jkmHistory.length} days`)

      // Update sparkline + price from history (JKM live quote often unavailable)
      const latestJKM = jkmHistory[jkmHistory.length - 1]
      if (latestJKM) {
        const prevJKM = jkmHistory.length > 1 ? jkmHistory[jkmHistory.length - 2] : latestJKM
        const jkmChange = Number((latestJKM.close - prevJKM.close).toFixed(3))
        const jkmChangePct = prevJKM.close > 0 ? Number(((jkmChange / prevJKM.close) * 100).toFixed(2)) : 0
        await supabaseAdmin.from('prices').upsert({
          commodity: 'jkm',
          price: latestJKM.close,
          change: jkmChange,
          change_pct: jkmChangePct,
          currency: 'USD',
          unit: 'MMBtu',
          source: 'yahoo_finance',
          sparkline_5d: jkmHistory.slice(-5).map((h) => h.close),
        }, { onConflict: 'commodity' })
      }
    }

    // 7g. Urals India CIF history (Urals FOB + freight)
    if (brentHistory.length) {
      const uralsIndiaHistory = brentHistory.map((h) => {
        const uralsFOB = h.close - uralsDiscount
        const indiaCIF = Number((uralsFOB + URALS_INDIA_FREIGHT).toFixed(2))
        return {
          commodity: 'urals_india',
          date: h.date,
          open: Number((h.open - uralsDiscount + URALS_INDIA_FREIGHT).toFixed(2)),
          high: Number((h.high - uralsDiscount + URALS_INDIA_FREIGHT).toFixed(2)),
          low: Number((h.low - uralsDiscount + URALS_INDIA_FREIGHT).toFixed(2)),
          close: indiaCIF,
          volume: null,
        }
      })
      const { error } = await supabaseAdmin
        .from('price_history')
        .upsert(uralsIndiaHistory, { onConflict: 'commodity,date' })
      if (error) errors.push(`price_history urals_india: ${error.message}`)
      else console.log(`  ✓ Urals India history: ${uralsIndiaHistory.length} days (derived)`)

      // ── Upsert Urals India into prices table ──
      const latestIndiaPrice = uralsIndiaHistory[uralsIndiaHistory.length - 1].close
      const sparkline = uralsIndiaHistory.slice(-5).map((h) => h.close)
      await supabaseAdmin.from('prices').upsert({
        commodity: 'urals_india',
        price: latestIndiaPrice,
        change: Number((brentYahoo?.regularMarketChange || 0).toFixed(2)),
        change_pct: Number((brentYahoo?.regularMarketChangePercent || 0).toFixed(2)),
        currency: 'USD',
        unit: 'bbl',
        source: 'derived',
        sparkline_5d: sparkline,
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
