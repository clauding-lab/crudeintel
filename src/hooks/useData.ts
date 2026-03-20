import { useState, useEffect } from 'react'
import type { PricesLatest, NewsFeed, EnergyBrief, Fundamentals, PriceHistory } from '@/types/data'
import { mockPrices, mockNews, mockBrief, mockFundamentals, mockBrentHistory } from '@/data/mock'
import { supabase } from '@/lib/supabase'

// ─── Supabase-powered hooks (with mock fallback) ────────────

export function usePrices() {
  const [data, setData] = useState<PricesLatest>(mockPrices)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    async function fetch() {
      try {
        const [
          { data: prices },
          { data: fx },
          { data: pipeline },
        ] = await Promise.all([
          supabase!.from('prices').select('*'),
          supabase!.from('exchange_rates').select('*').eq('pair', 'USD/RUB').single(),
          supabase!.from('pipeline_runs').select('*').eq('pipeline', 'prices').order('started_at', { ascending: false }).limit(1).single(),
        ])

        if (!prices?.length) return

        const byName = (name: string) => prices.find((p) => p.commodity === name)
        const brent = byName('brent')
        const urals = byName('urals')
        const hh = byName('henry_hub')
        const ttf = byName('ttf')
        const wti = byName('wti')
        const opec = byName('opec_basket')
        const uralsIndia = byName('urals_india')
        const jkm = byName('jkm')

        if (!brent || !hh || !ttf) return

        const toPriceData = (row: typeof brent) => ({
          price: Number(row.price),
          change: Number(row.change),
          change_pct: Number(row.change_pct),
          currency: row.currency,
          unit: row.unit,
          source: row.source,
          timestamp: row.fetched_at,
          sparkline_5d: (row.sparkline_5d || []).map(Number),
          ...(row.discount_from_brent ? {
            discount_from_brent: Number(row.discount_from_brent),
            discount_source: row.discount_source || undefined,
            discount_updated: row.discount_updated || undefined,
          } : {}),
        })

        setData({
          updated_at: pipeline?.started_at || brent.fetched_at,
          pipeline_status: pipeline?.status || 'success',
          prices: {
            brent: toPriceData(brent),
            urals: urals ? toPriceData(urals) : mockPrices.prices.urals,
            henry_hub: toPriceData(hh),
            ttf: toPriceData(ttf),
            urals_india: uralsIndia ? toPriceData(uralsIndia) : mockPrices.prices.urals_india,
            jkm: jkm ? toPriceData(jkm) : mockPrices.prices.jkm,
          },
          reference: {
            wti: wti
              ? { price: Number(wti.price), change_pct: Number(wti.change_pct) }
              : mockPrices.reference.wti,
            opec_basket: opec
              ? { price: Number(opec.price), change_pct: Number(opec.change_pct) }
              : mockPrices.reference.opec_basket,
            usd_rub: fx
              ? { rate: Number(fx.rate), change_pct: Number(fx.change_pct) }
              : mockPrices.reference.usd_rub,
          },
        })
      } catch (err) {
        console.warn('[usePrices] Supabase query failed, using mock data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetch()

    // Real-time subscription for live price updates
    const channel = supabase
      .channel('prices-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prices' }, () => {
        fetch() // Re-fetch all prices when any price row changes
      })
      .subscribe()

    return () => { supabase!.removeChannel(channel) }
  }, [])

  return { data, loading }
}

export function useNews() {
  const [data, setData] = useState<NewsFeed>(mockNews)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    async function fetch() {
      try {
        const { data: items } = await supabase!
          .from('news_items')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(20)

        if (!items?.length) return

        setData({
          updated_at: items[0].fetched_at,
          items: items.map((n) => ({
            id: n.id,
            title: n.title,
            source: n.source,
            url: n.url,
            published_at: n.published_at,
            category: n.category,
            ai_summary: n.ai_summary || '',
            ai_category_confidence: Number(n.ai_category_confidence),
          })),
        })
      } catch (err) {
        console.warn('[useNews] Supabase query failed, using mock data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  return { data, loading }
}

export function useBrief() {
  const [data, setData] = useState<EnergyBrief>(mockBrief)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    async function fetch() {
      try {
        const { data: brief } = await supabase!
          .from('energy_briefs')
          .select('*')
          .order('date', { ascending: false })
          .limit(1)
          .single()

        if (!brief) return

        setData({
          date: brief.date,
          generated_at: brief.generated_at,
          headline: brief.headline,
          sections: {
            market_recap: brief.market_recap,
            key_developments: brief.key_developments as Array<{ item: string; so_what: string }>,
            geopolitical_radar: brief.geopolitical_radar,
            desk_implications: brief.desk_implications || [],
            data_watch: brief.data_watch as Array<{ date: string; event: string; relevance: string }>,
          },
          branding: {
            author: brief.author,
            product: brief.product,
            ai_disclosure: brief.ai_disclosure,
          },
        })
      } catch (err) {
        console.warn('[useBrief] Supabase query failed, using mock data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  return { data, loading }
}

export function useFundamentals() {
  const [data, setData] = useState<Fundamentals>(mockFundamentals)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    async function fetch() {
      try {
        const [
          { data: inventories },
          { data: rigs },
          { data: opec },
          { data: refinery },
          { data: production },
        ] = await Promise.all([
          supabase!.from('eia_inventories').select('*').order('report_date', { ascending: false }).limit(12),
          supabase!.from('rig_counts').select('*').order('report_date', { ascending: false }).limit(26),
          supabase!.from('opec_compliance').select('*').order('report_date', { ascending: false }).limit(8),
          supabase!.from('refinery_utilization').select('*').order('report_date', { ascending: false }).limit(12),
          supabase!.from('us_production').select('*').order('report_date', { ascending: false }).limit(26),
        ])

        const latest = (arr: Array<Record<string, unknown>> | null) => arr?.[0]

        const latestInv = latest(inventories)
        const latestRig = latest(rigs)
        const latestRef = latest(refinery)
        const latestProd = latest(production)

        if (!latestInv && !latestRig) return

        setData({
          updated_at: (latestInv?.fetched_at || latestRig?.fetched_at || new Date().toISOString()) as string,
          eia_inventories: {
            current_week: latestInv
              ? { date: latestInv.report_date as string, value_mb: Number(latestInv.value_mb), change_mb: Number(latestInv.change_mb) }
              : mockFundamentals.eia_inventories.current_week,
            five_year_avg_mb: latestInv ? Number(latestInv.five_year_avg_mb || 440.5) : 440.5,
            history_12w: inventories
              ? inventories.map((r) => Number(r.value_mb)).reverse()
              : mockFundamentals.eia_inventories.history_12w,
          },
          baker_hughes_rig_count: {
            date: (latestRig?.report_date as string) || mockFundamentals.baker_hughes_rig_count.date,
            oil_rigs: latestRig ? Number(latestRig.oil_rigs) : mockFundamentals.baker_hughes_rig_count.oil_rigs,
            change: latestRig ? Number(latestRig.change) : mockFundamentals.baker_hughes_rig_count.change,
            history_26w: rigs
              ? rigs.map((r) => Number(r.oil_rigs)).reverse()
              : mockFundamentals.baker_hughes_rig_count.history_26w,
          },
          opec_compliance: {
            report_date: opec?.[0]
              ? (opec[0].report_date as string)
              : mockFundamentals.opec_compliance.report_date,
            source: opec?.[0]
              ? (opec[0].source as string)
              : mockFundamentals.opec_compliance.source,
            members: opec?.length
              ? opec.map((m) => ({
                  country: m.country as string,
                  quota_mbd: Number(m.quota_mbd),
                  estimated_mbd: Number(m.estimated_mbd),
                  compliance_pct: Number(m.compliance_pct),
                }))
              : mockFundamentals.opec_compliance.members,
          },
          refinery_utilization: {
            date: (latestRef?.report_date as string) || mockFundamentals.refinery_utilization.date,
            value_pct: latestRef ? Number(latestRef.value_pct) : mockFundamentals.refinery_utilization.value_pct,
            history_12w: refinery
              ? refinery.map((r) => Number(r.value_pct)).reverse()
              : mockFundamentals.refinery_utilization.history_12w,
          },
          us_production: {
            date: (latestProd?.report_date as string) || mockFundamentals.us_production.date,
            value_mbd: latestProd ? Number(latestProd.value_mbd) : mockFundamentals.us_production.value_mbd,
            history_26w: production
              ? production.map((r) => Number(r.value_mbd)).reverse()
              : mockFundamentals.us_production.history_26w,
          },
        })
      } catch (err) {
        console.warn('[useFundamentals] Supabase query failed, using mock data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  return { data, loading }
}

export function useChartData(commodity: string = 'brent') {
  const [data, setData] = useState<PriceHistory>(mockBrentHistory)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    async function fetch() {
      try {
        const { data: history } = await supabase!
          .from('price_history')
          .select('*')
          .eq('commodity', commodity)
          .order('date', { ascending: true })
          .limit(365)

        if (!history?.length) return

        setData({
          commodity,
          interval: 'daily',
          data: history.map((h) => ({
            date: h.date,
            open: Number(h.open),
            high: Number(h.high),
            low: Number(h.low),
            close: Number(h.close),
            volume: h.volume ? Number(h.volume) : undefined,
          })),
        })
      } catch (err) {
        console.warn('[useChartData] Supabase query failed, using mock data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [commodity])

  return { data, loading }
}
