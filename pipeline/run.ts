/**
 * Master pipeline runner — runs all or specific pipelines
 *
 * Usage:
 *   npx tsx pipeline/run.ts              # run all
 *   npx tsx pipeline/run.ts prices       # run prices only
 *   npx tsx pipeline/run.ts news brief   # run news + brief
 */

import 'dotenv/config'
import { readFileSync } from 'fs'

// Re-apply .env with override for keys that may conflict with host environment
try {
  const envContent = readFileSync('.env', 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match) process.env[match[1]] = match[2]
  }
} catch { /* ignore */ }

import { run as fetchPrices } from './fetch-prices.js'
import { run as fetchNews } from './fetch-news.js'
import { run as fetchFundamentals } from './fetch-fundamentals.js'
import { run as generateBrief } from './generate-brief.js'

const PIPELINES: Record<string, () => Promise<void>> = {
  prices: fetchPrices,
  news: fetchNews,
  fundamentals: fetchFundamentals,
  brief: generateBrief,
}

async function main() {
  const args = process.argv.slice(2)
  const toRun = args.length ? args : Object.keys(PIPELINES)

  console.log(`\n🛢️  CrudeIntel Pipeline — ${new Date().toISOString()}`)
  console.log(`   Running: ${toRun.join(', ')}\n`)

  for (const name of toRun) {
    const pipeline = PIPELINES[name]
    if (!pipeline) {
      console.error(`Unknown pipeline: ${name}`)
      console.error(`Available: ${Object.keys(PIPELINES).join(', ')}`)
      process.exit(1)
    }

    console.log(`── ${name} ${'─'.repeat(50 - name.length)}`)
    const start = Date.now()
    await pipeline()
    console.log(`   Done in ${((Date.now() - start) / 1000).toFixed(1)}s\n`)
  }

  console.log('✅ Pipeline complete\n')
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Pipeline crashed:', err)
  process.exit(1)
})
