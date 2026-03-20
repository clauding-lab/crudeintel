/**
 * Pipeline: Generate daily Energy Desk Read using Claude AI
 *
 * Pulls today's prices, news, and fundamentals from Supabase,
 * then asks Claude to write a structured analyst brief.
 *
 * Schedule: Daily at 17:30 UTC
 */

import { supabaseAdmin, logPipelineStart, logPipelineEnd } from './supabase-admin.js'

// Read lazily to allow dotenv override before first use
function getAnthropicKey() { return process.env.ANTHROPIC_API_KEY }

async function gatherContext(): Promise<string> {
  // Pull latest data from Supabase for Claude's context
  const [
    { data: prices },
    { data: news },
    { data: spreads },
    { data: inventories },
    { data: rigs },
    { data: exchangeRate },
  ] = await Promise.all([
    supabaseAdmin.from('prices').select('*'),
    supabaseAdmin.from('news_items').select('*').order('published_at', { ascending: false }).limit(10),
    supabaseAdmin.from('spreads').select('*').limit(1),
    supabaseAdmin.from('eia_inventories').select('*').order('report_date', { ascending: false }).limit(1),
    supabaseAdmin.from('rig_counts').select('*').order('report_date', { ascending: false }).limit(1),
    supabaseAdmin.from('exchange_rates').select('*').eq('pair', 'USD/RUB').limit(1),
  ])

  const sections = []

  if (prices?.length) {
    sections.push('## Latest Prices')
    for (const p of prices) {
      sections.push(`- ${p.commodity}: ${p.price} ${p.currency}/${p.unit} (${p.change_pct > 0 ? '+' : ''}${p.change_pct}%)`)
    }
  }

  if (spreads?.length) {
    sections.push(`\n## Urals-Brent Spread: $${Math.abs(spreads[0].value)} discount (${spreads[0].direction})`)
  }

  if (exchangeRate?.length) {
    sections.push(`\n## USD/RUB: ${exchangeRate[0].rate} (${exchangeRate[0].change_pct > 0 ? '+' : ''}${exchangeRate[0].change_pct}%)`)
  }

  if (inventories?.length) {
    sections.push(`\n## EIA Inventories: ${inventories[0].value_mb}mb (change: ${inventories[0].change_mb}mb)`)
  }

  if (rigs?.length) {
    sections.push(`\n## Baker Hughes Rig Count: ${rigs[0].oil_rigs} (change: ${rigs[0].change})`)
  }

  if (news?.length) {
    sections.push('\n## Today\'s Headlines')
    for (const n of news) {
      sections.push(`- [${n.category}] ${n.title} (${n.source})`)
    }
  }

  return sections.join('\n')
}

async function generateWithClaude(context: string): Promise<{
  headline: string
  market_recap: string
  key_developments: Array<{ item: string; so_what: string }>
  geopolitical_radar: string
  desk_implications: string[]
  data_watch: Array<{ date: string; event: string; relevance: string }>
} | null> {
  if (!getAnthropicKey()) {
    console.error('ANTHROPIC_API_KEY not set — cannot generate brief')
    return null
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getAnthropicKey()!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a senior energy market analyst writing the daily "CrudeIntel Desk Read" briefing for ${today}.

Based on today's market data and news:

${context}

Write a structured brief in the following JSON format:
{
  "headline": "One punchy headline (max 12 words)",
  "market_recap": "3-4 paragraph market recap covering oil, gas, spreads, and FX. Write like a Bloomberg terminal note — concise, data-rich, opinionated.",
  "key_developments": [
    {"item": "Development title", "so_what": "One sentence explaining trading implications"},
    ... (3-5 items)
  ],
  "geopolitical_radar": "2-3 paragraph geopolitical risk assessment covering Strait of Hormuz, Russia/Sanctions, OPEC+ dynamics, and US policy. Use format: REGION: RISK_LEVEL — analysis.",
  "desk_implications": ["Action-oriented trading implication 1", "...", "..."],
  "data_watch": [
    {"date": "YYYY-MM-DD", "event": "Event name", "relevance": "Why it matters"},
    ... (3-5 upcoming events in the next 7 days)
  ]
}

Respond ONLY with valid JSON, no markdown or commentary.`
        }],
      }),
    })

    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    return JSON.parse(text)
  } catch (err) {
    console.error('Claude brief generation failed:', err)
    return null
  }
}

// ─── Main ───────────────────────────────────────────────────
export async function run() {
  const runId = await logPipelineStart('brief')

  try {
    // 1. Gather context from today's data
    const context = await gatherContext()
    if (!context.trim()) {
      console.warn('[brief] No data available — skipping brief generation')
      await logPipelineEnd(runId, 'partial', 'No data available')
      return
    }

    console.log('[brief] Context gathered, generating with Claude...')

    // 2. Generate brief
    const brief = await generateWithClaude(context)
    if (!brief) {
      await logPipelineEnd(runId, 'failed', 'Claude generation returned null')
      return
    }

    // 3. Upsert into Supabase
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabaseAdmin
      .from('energy_briefs')
      .upsert({
        date: today,
        headline: brief.headline,
        market_recap: brief.market_recap,
        key_developments: brief.key_developments,
        geopolitical_radar: brief.geopolitical_radar,
        desk_implications: brief.desk_implications,
        data_watch: brief.data_watch,
        author: 'Adnan Rashid',
        product: 'The energy briefing.',
        ai_disclosure: 'Produced with Claude AI',
      }, { onConflict: 'date' })

    if (error) {
      console.error('[brief] Upsert failed:', error.message)
      await logPipelineEnd(runId, 'failed', error.message)
    } else {
      console.log(`[brief] Success — "${brief.headline}"`)
      await logPipelineEnd(runId, 'success')
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[brief] FAILED:`, msg)
    await logPipelineEnd(runId, 'failed', msg)
  }
}

if (process.argv[1]?.endsWith('generate-brief.ts') || process.argv[1]?.endsWith('generate-brief.js')) {
  run().then(() => process.exit(0))
}
