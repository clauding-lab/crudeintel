/**
 * Pipeline: Fetch energy fundamentals from EIA API
 *
 * Sources:
 *   - EIA API → crude inventories, refinery utilization, US production
 *   - Baker Hughes (via EIA or direct) → rig counts
 *
 * Schedule: Wed & Fri (matches EIA report cadence)
 */

import { supabaseAdmin, logPipelineStart, logPipelineEnd } from './supabase-admin.js'

const EIA_API_KEY = process.env.EIA_API_KEY
const EIA_BASE = 'https://api.eia.gov/v2'

interface EIAResponse {
  response: {
    data: Array<Record<string, string | number>>
  }
}

async function fetchEIA(seriesId: string, length: number = 26): Promise<EIAResponse | null> {
  if (!EIA_API_KEY) {
    console.warn('EIA_API_KEY not set — skipping EIA fetch')
    return null
  }

  try {
    const res = await fetch(
      `${EIA_BASE}/seriesid/${seriesId}?api_key=${EIA_API_KEY}&length=${length}&out=json`
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error(`Failed to fetch EIA series ${seriesId}:`, err)
    return null
  }
}

// ─── EIA Crude Inventories ──────────────────────────────────
// Series: PET.WCESTUS1.W (Weekly US ending stocks of crude)
async function fetchCrudeInventories() {
  const data = await fetchEIA('PET.WCESTUS1.W', 14)
  if (!data?.response?.data) return []

  return data.response.data.map((row) => ({
    report_date: String(row.period),
    value_mb: Number(row.value) / 1000, // Convert thousand barrels to million barrels
    change_mb: 0, // Will be calculated
    five_year_avg_mb: 440.5, // Placeholder — ideally fetch 5-year avg separately
  }))
}

// ─── EIA Refinery Utilization ───────────────────────────────
// Series: PET.WPULEUS3.W (Weekly US refinery utilization rate)
async function fetchRefineryUtilization() {
  const data = await fetchEIA('PET.WPULEUS3.W', 14)
  if (!data?.response?.data) return []

  return data.response.data.map((row) => ({
    report_date: String(row.period),
    value_pct: Number(row.value),
  }))
}

// ─── EIA US Production ─────────────────────────────────────
// Series: PET.WCRFPUS2.W (Weekly US field production of crude)
async function fetchUSProduction() {
  const data = await fetchEIA('PET.WCRFPUS2.W', 28)
  if (!data?.response?.data) return []

  return data.response.data.map((row) => ({
    report_date: String(row.period),
    value_mbd: Number(row.value) / 1000,
  }))
}

// ─── Baker Hughes Rig Counts (via AOGR public data) ─────────
// Source: aogr.com/web-exclusives/us-rig-count/{year}
// Published weekly on Fridays. Data from Baker Hughes.
async function fetchRigCounts() {
  const year = new Date().getFullYear()
  try {
    const res = await fetch(
      `https://www.aogr.com/web-exclusives/us-rig-count/${year}`,
      { headers: { 'User-Agent': 'CrudeIntel/1.0' }, signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // Parse AOGR HTML structure:
    // Date: <span class="column-margin rc-date">03/13/2026</span>
    // Oil:  <span class="column-margin rc-oik"><span class="text-green">+1</span> (412)</span>
    const rows: Array<{ report_date: string; oil_rigs: number; change: number }> = []

    // Extract all date blocks and their associated oil rig data
    const dateRegex = /rc-date">(\d{2})\/(\d{2})\/(\d{4})<\/span>/g
    const oilRegex = /rc-oik">(?:<span[^>]*>([+-]?\d+)<\/span>|([+-]?\d+))\s*\((\d+)\)<\/span>/g

    const dates: string[] = []
    let match
    while ((match = dateRegex.exec(html)) !== null) {
      const [, mm, dd, yyyy] = match
      dates.push(`${yyyy}-${mm}-${dd}`)
    }

    const oilData: Array<{ rigs: number; change: number }> = []
    while ((match = oilRegex.exec(html)) !== null) {
      const change = parseInt(match[1] || match[2] || '0')
      const rigs = parseInt(match[3])
      oilData.push({ rigs, change })
    }

    for (let i = 0; i < Math.min(dates.length, oilData.length); i++) {
      rows.push({
        report_date: dates[i],
        oil_rigs: oilData[i].rigs,
        change: oilData[i].change,
      })
    }

    if (rows.length) {
      console.log(`[fundamentals] Scraped ${rows.length} rig count weeks from AOGR`)
      return rows.slice(0, 26) // Keep last 26 weeks
    }

    console.warn('[fundamentals] Could not parse rig count data from AOGR')
    return []
  } catch (err) {
    console.warn('[fundamentals] Rig count fetch failed:', err instanceof Error ? err.message : err)
    return []
  }
}

// ─── Main ───────────────────────────────────────────────────
export async function run() {
  const runId = await logPipelineStart('fundamentals')
  const errors: string[] = []

  try {
    // Fetch all in parallel
    const [inventories, refinery, production, rigs] = await Promise.all([
      fetchCrudeInventories(),
      fetchRefineryUtilization(),
      fetchUSProduction(),
      fetchRigCounts(),
    ])

    // ── Inventories ──
    if (inventories.length) {
      // Calculate week-over-week change
      for (let i = 1; i < inventories.length; i++) {
        inventories[i].change_mb = Number((inventories[i].value_mb - inventories[i - 1].value_mb).toFixed(1))
      }
      const { error } = await supabaseAdmin
        .from('eia_inventories')
        .upsert(inventories, { onConflict: 'report_date' })
      if (error) errors.push(`eia_inventories: ${error.message}`)
      else console.log(`[fundamentals] Inventories: ${inventories.length} rows`)
    }

    // ── Refinery Utilization ──
    if (refinery.length) {
      const { error } = await supabaseAdmin
        .from('refinery_utilization')
        .upsert(refinery, { onConflict: 'report_date' })
      if (error) errors.push(`refinery_utilization: ${error.message}`)
      else console.log(`[fundamentals] Refinery: ${refinery.length} rows`)
    }

    // ── US Production ──
    if (production.length) {
      const { error } = await supabaseAdmin
        .from('us_production')
        .upsert(production, { onConflict: 'report_date' })
      if (error) errors.push(`us_production: ${error.message}`)
      else console.log(`[fundamentals] Production: ${production.length} rows`)
    }

    // ── Rig Counts ──
    if (rigs.length) {
      const { error } = await supabaseAdmin
        .from('rig_counts')
        .upsert(rigs, { onConflict: 'report_date' })
      if (error) errors.push(`rig_counts: ${error.message}`)
      else console.log(`[fundamentals] Rigs: ${rigs.length} rows`)
    }

    const status = errors.length === 0 ? 'success' : 'partial'
    console.log(`[fundamentals] ${status} — ${errors.length} errors`)
    await logPipelineEnd(runId, status, errors.join('; '))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[fundamentals] FAILED:`, msg)
    await logPipelineEnd(runId, 'failed', msg)
  }
}

if (process.argv[1]?.endsWith('fetch-fundamentals.ts') || process.argv[1]?.endsWith('fetch-fundamentals.js')) {
  run().then(() => process.exit(0))
}
