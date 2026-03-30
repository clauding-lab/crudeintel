# Trading Economics Price Source Migration

**Date:** 2026-03-30
**Status:** Draft
**Scope:** Replace primary commodity price sources with Trading Economics scraping

## Problem

Current price data comes from Yahoo Finance (commodities), Twelve Data (USD/RUB), and FT Markets (Urals). Key issues:
- Urals crude price is **derived** from Brent using a discount formula — not a real market price
- Multiple data source dependencies increase maintenance burden
- Yahoo Finance free API is undocumented and occasionally unreliable

## Solution

**Hybrid approach**: Scrape Trading Economics pages for current price snapshots, keep Yahoo Finance for historical OHLCV data (charts).

### What Changes
- **Primary price source**: Trading Economics (scrape `TEChartsMeta` from commodity pages)
- **Urals**: Real OTC price from TE (`URDB:COM`) replaces derived calculation
- **USD/RUB**: From TE (`/russia/currency`) instead of Twelve Data
- **Twelve Data**: Demoted to fallback for USD/RUB only
- **FT Markets**: Removed (TE provides better Urals data)

### What Stays
- Yahoo Finance for historical OHLCV (365-day charts, sparklines)
- Supabase schema (no changes)
- All other pipelines (news, fundamentals, brief)
- Frontend (reads from same tables)
- GitHub Actions schedule

## Architecture

### TE Scraping Strategy

Each commodity page at `tradingeconomics.com/commodity/{slug}` embeds a `TEChartsMeta` JavaScript variable containing structured price data:

```javascript
var TEChartsMeta = [{"value":112.498700,"symbol":"CO1:COM","name":"Brent crude oil",...}]
```

Extraction via regex: `/var\s+TEChartsMeta\s*=\s*(\[.*?\]);/s`

### Commodity Mapping

| Internal Name | TE Slug | TE Symbol | Yahoo Fallback |
|--------------|---------|-----------|----------------|
| brent | /commodity/brent-crude-oil | CO1:COM | BZ=F |
| wti | /commodity/crude-oil | CL1:COM | CL=F |
| henry_hub | /commodity/natural-gas | NG1:COM | NG=F |
| ttf | /commodity/eu-natural-gas | TTFG1MON:COM | TTF=F |
| jkm | /commodity/lng | TBD | JKM=F |
| urals | /commodity/urals-oil | URDB:COM | Derived from Brent |
| usd_rub | /russia/currency | USDRUB:CUR | Twelve Data |

### Fallback Chain

```
For each commodity:
  1. Trading Economics scrape → parse TEChartsMeta
  2. If TE fails → Yahoo Finance live quote
  3. If Yahoo fails → Keep existing Supabase value
```

### Rate Limiting
- 2-second delay between TE page fetches
- Browser-like User-Agent headers
- 15-second timeout per request
- ~8 requests per pipeline run (well within reasonable limits)

## Derived Commodities

- **Urals India CIF**: Real Urals price (from TE) + $10 freight — now based on real data
- **OPEC Basket**: Brent - $2.30 (unchanged, still derived)

## Data Flow

```
fetch-prices.ts (modified)
│
├── Step 1: Scrape TE pages (8 commodities, 2s apart)
│   └── Extract TEChartsMeta → current prices
│
├── Step 2: Fallback any TE failures → Yahoo live quotes
│
├── Step 3: Yahoo historical OHLCV (unchanged)
│   └── 90-365 day history per commodity
│
├── Step 4: Calculate sparklines from history
│
├── Step 5: Derive Urals India CIF, OPEC Basket, spreads
│
└── Step 6: Upsert to Supabase (prices, price_history, spreads, exchange_rates)
```

## Files Modified

1. **`pipeline/fetch-prices.ts`** — Main changes: add TE scraper, refactor price flow, keep Yahoo for history
2. **`.env.example`** — Remove TWELVE_DATA_API_KEY requirement

## Risks

- **TE HTML structure change**: Mitigated by Yahoo fallback
- **IP blocking**: Mitigated by rate limiting and browser-like headers
- **JKM LNG availability**: TE page may not have data; Yahoo remains fallback
- **Terms of service**: Scraping TE may violate ToS; user accepts this risk

## Verification

1. Run `npm run pipeline:prices` — verify TE prices in Supabase
2. Check `prices.source` column shows `'trading_economics'`
3. Verify Urals is real price (not derived)
4. Confirm charts still render (Yahoo historical data intact)
5. Break TE URL temporarily → verify Yahoo fallback works
6. Full pipeline run: no regressions in news/fundamentals/brief
