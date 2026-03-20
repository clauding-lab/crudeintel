/**
 * Pipeline: Fetch energy news from RSS feeds + AI categorization via Claude
 *
 * Sources:
 *   - Google News RSS → aggregates Reuters, Bloomberg, FT, etc.
 *   - OilPrice.com RSS → dedicated energy news
 *   - Claude AI → categorization + analyst summary
 *
 * Schedule: Every 4 hours
 */

import { supabaseAdmin, logPipelineStart, logPipelineEnd } from './supabase-admin.js'
import Parser from 'rss-parser'

function getAnthropicKey() { return process.env.ANTHROPIC_API_KEY }

const CATEGORIES = ['opec_plus', 'geopolitics', 'supply', 'demand', 'lng', 'russia_sanctions'] as const

// ─── RSS Feed URLs ─────────────────────────────────────────
const RSS_FEEDS = [
  // Google News — multiple energy-focused queries
  {
    name: 'Google News (Oil)',
    url: 'https://news.google.com/rss/search?q=crude+oil+price+brent+wti&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Google News (OPEC)',
    url: 'https://news.google.com/rss/search?q=OPEC+oil+production&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Google News (Energy)',
    url: 'https://news.google.com/rss/search?q=natural+gas+LNG+energy+market&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Google News (Sanctions)',
    url: 'https://news.google.com/rss/search?q=oil+sanctions+russia+iran+geopolitics&hl=en-US&gl=US&ceid=US:en',
  },
  // OilPrice.com — dedicated energy news
  {
    name: 'OilPrice.com',
    url: 'https://oilprice.com/rss/main',
  },
]

interface RawArticle {
  title: string
  source: string
  url: string
  publishedAt: string
  description: string | null
}

// ─── Fetch RSS feeds ───────────────────────────────────────
async function fetchRSSArticles(): Promise<RawArticle[]> {
  const parser = new Parser({
    timeout: 15000,
    headers: { 'User-Agent': 'CrudeIntel/1.0' },
  })

  const allArticles: RawArticle[] = []
  const seenUrls = new Set<string>()

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`  [rss] Fetching ${feed.name}...`)
      const parsed = await parser.parseURL(feed.url)

      for (const item of (parsed.items || []).slice(0, 10)) {
        if (!item.title || !item.link) continue

        // Deduplicate by URL
        const url = item.link.split('?')[0] // Strip tracking params
        if (seenUrls.has(url)) continue
        seenUrls.add(url)

        // Extract source from Google News title format: "Title - Source"
        let source = feed.name
        let title = item.title || ''
        if (feed.name.startsWith('Google News')) {
          const parts = title.split(' - ')
          if (parts.length > 1) {
            source = parts.pop()!.trim()
            title = parts.join(' - ').trim()
          }
        } else if (feed.name === 'OilPrice.com') {
          source = 'OilPrice.com'
        }

        allArticles.push({
          title,
          source,
          url: item.link,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          description: item.contentSnippet || item.content || null,
        })
      }

      console.log(`  [rss] ✓ ${feed.name}: ${parsed.items?.length || 0} items`)
    } catch (err) {
      console.warn(`  [rss] ⚠ ${feed.name} failed:`, err instanceof Error ? err.message : err)
    }
  }

  // Sort by date (newest first) and take top 20
  allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return allArticles.slice(0, 20)
}

// ─── AI Categorization ─────────────────────────────────────

interface AICategorization {
  category: string
  summary: string
  confidence: number
}

async function categorizeWithClaude(title: string, description: string | null): Promise<AICategorization> {
  if (!getAnthropicKey()) {
    return keywordCategorize(title)
  }

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
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Categorize this energy news headline and write a 1-sentence analyst summary for an energy trading desk.

Title: ${title}
Description: ${description || 'N/A'}

Categories: opec_plus, geopolitics, supply, demand, lng, russia_sanctions

Respond ONLY in this JSON format:
{"category": "...", "summary": "...", "confidence": 0.0-1.0}`
        }],
      }),
    })

    if (!res.ok) throw new Error(`Claude API ${res.status}`)
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const parsed = JSON.parse(text)
    return {
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'supply',
      summary: parsed.summary || title,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    }
  } catch (err) {
    console.warn('  [ai] Claude fallback:', err instanceof Error ? err.message : err)
    return keywordCategorize(title)
  }
}

function keywordCategorize(title: string): AICategorization {
  const lower = title.toLowerCase()
  let category = 'supply'
  let confidence = 0.6

  if (lower.includes('opec') || lower.includes('output cut') || lower.includes('production cut') || lower.includes('oil cartel')) {
    category = 'opec_plus'; confidence = 0.85
  } else if (lower.includes('russia') || lower.includes('urals') || lower.includes('sanctions') || lower.includes('price cap')) {
    category = 'russia_sanctions'; confidence = 0.82
  } else if (lower.includes('lng') || lower.includes('liquefied') || lower.includes('ttf') || lower.includes('natural gas') || lower.includes('gas price')) {
    category = 'lng'; confidence = 0.80
  } else if (lower.includes('iran') || lower.includes('strait') || lower.includes('conflict') || lower.includes('geopolit') || lower.includes('war') || lower.includes('attack') || lower.includes('military') || lower.includes('tension')) {
    category = 'geopolitics'; confidence = 0.78
  } else if (lower.includes('demand') || lower.includes('consumption') || lower.includes('gdp') || lower.includes('recession') || lower.includes('growth') || lower.includes('refiner')) {
    category = 'demand'; confidence = 0.75
  } else if (lower.includes('inventor') || lower.includes('production') || lower.includes('rig') || lower.includes('supply') || lower.includes('drilling') || lower.includes('barrel')) {
    category = 'supply'; confidence = 0.75
  }

  return { category, summary: title, confidence }
}

function generateNewsId(publishedAt: string, index: number): string {
  const dateStr = publishedAt.split('T')[0].replace(/-/g, '')
  return `news-${dateStr}-${String(index + 1).padStart(3, '0')}`
}

// ─── Main ───────────────────────────────────────────────────
export async function run() {
  const runId = await logPipelineStart('news')
  const errors: string[] = []

  try {
    // 1. Fetch from RSS feeds
    const articles = await fetchRSSArticles()
    if (articles.length === 0) {
      console.log('[news] No articles found from any feed')
      await logPipelineEnd(runId, 'partial', 'No articles from RSS feeds')
      return
    }

    console.log(`[news] Got ${articles.length} unique articles, categorizing with Claude...`)

    // 2. Categorize each article
    const newsItems = []
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]
      const { category, summary, confidence } = await categorizeWithClaude(
        article.title,
        article.description,
      )

      newsItems.push({
        id: generateNewsId(article.publishedAt, i),
        title: article.title,
        source: article.source,
        url: article.url,
        published_at: article.publishedAt,
        category,
        ai_summary: summary,
        ai_category_confidence: confidence,
      })

      // Small delay between Claude calls
      if (getAnthropicKey() && i < articles.length - 1) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    // 3. Clear old news (keep last 50 items max)
    const { data: existing } = await supabaseAdmin
      .from('news_items')
      .select('id')
      .order('published_at', { ascending: false })
      .range(50, 999)

    if (existing?.length) {
      const oldIds = existing.map((r) => r.id)
      await supabaseAdmin.from('news_items').delete().in('id', oldIds)
      console.log(`[news] Cleaned up ${oldIds.length} old articles`)
    }

    // 4. Upsert new items
    const { error } = await supabaseAdmin
      .from('news_items')
      .upsert(newsItems, { onConflict: 'id' })

    if (error) {
      errors.push(`news upsert: ${error.message}`)
    }

    const status = errors.length === 0 ? 'success' : 'partial'
    console.log(`[news] ${status} — ${newsItems.length} items from RSS, ${errors.length} errors`)
    await logPipelineEnd(runId, status, errors.join('; '))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[news] FAILED:`, msg)
    await logPipelineEnd(runId, 'failed', msg)
  }
}

if (process.argv[1]?.endsWith('fetch-news.ts') || process.argv[1]?.endsWith('fetch-news.js')) {
  import('dotenv/config').then(() => run().then(() => process.exit(0)))
}
