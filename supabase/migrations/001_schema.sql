-- ============================================================
-- CrudeIntel Database Schema
-- Run this in Supabase SQL Editor or via CLI: supabase db push
-- ============================================================

-- ─── PRICES ─────────────────────────────────────────────────
-- Stores latest snapshot for each commodity
create table if not exists prices (
  id            bigint generated always as identity primary key,
  commodity     text not null,                -- 'brent', 'urals', 'henry_hub', 'ttf', 'wti', 'opec_basket'
  price         numeric(10,2) not null,
  change        numeric(10,2) not null default 0,
  change_pct    numeric(6,2) not null default 0,
  currency      text not null default 'USD',
  unit          text not null default 'bbl',
  source        text not null default 'twelve_data',
  sparkline_5d  numeric(10,2)[] default '{}',
  -- Urals-specific fields
  discount_from_brent  numeric(10,2),
  discount_source      text,
  discount_updated     date,
  fetched_at    timestamptz not null default now(),
  constraint uq_prices_commodity unique (commodity)
);

-- ─── USD/RUB Exchange Rate ──────────────────────────────────
create table if not exists exchange_rates (
  id         bigint generated always as identity primary key,
  pair       text not null default 'USD/RUB',
  rate       numeric(10,4) not null,
  change_pct numeric(6,2) not null default 0,
  fetched_at timestamptz not null default now(),
  constraint uq_exchange_pair unique (pair)
);

-- ─── URALS-BRENT SPREAD ─────────────────────────────────────
create table if not exists spreads (
  id          bigint generated always as identity primary key,
  spread_name text not null default 'urals_brent',
  value       numeric(10,2) not null,
  direction   text not null default 'stable',  -- 'widening', 'narrowing', 'stable'
  trend_30d   numeric(10,2)[] default '{}',
  fetched_at  timestamptz not null default now(),
  constraint uq_spread_name unique (spread_name)
);

-- ─── PRICE HISTORY (for charts) ─────────────────────────────
create table if not exists price_history (
  id        bigint generated always as identity primary key,
  commodity text not null,
  date      date not null,
  open      numeric(10,2) not null,
  high      numeric(10,2) not null,
  low       numeric(10,2) not null,
  close     numeric(10,2) not null,
  volume    bigint,
  constraint uq_price_history unique (commodity, date)
);

create index if not exists idx_price_history_commodity_date
  on price_history (commodity, date desc);

-- ─── NEWS ───────────────────────────────────────────────────
create table if not exists news_items (
  id                      text primary key,          -- e.g. 'news-20260320-001'
  title                   text not null,
  source                  text not null,
  url                     text not null,
  published_at            timestamptz not null,
  category                text not null default 'all',
  ai_summary              text,
  ai_category_confidence  numeric(3,2) default 0,
  fetched_at              timestamptz not null default now()
);

create index if not exists idx_news_published
  on news_items (published_at desc);

create index if not exists idx_news_category
  on news_items (category);

-- ─── ENERGY BRIEFS ──────────────────────────────────────────
create table if not exists energy_briefs (
  id              bigint generated always as identity primary key,
  date            date not null unique,
  generated_at    timestamptz not null default now(),
  headline        text not null,
  market_recap    text not null,
  key_developments jsonb not null default '[]',     -- [{item, so_what}]
  geopolitical_radar text not null default '',
  desk_implications  text[] default '{}',
  data_watch      jsonb not null default '[]',      -- [{date, event, relevance}]
  author          text not null default 'Adnan Rashid',
  product         text not null default 'The energy briefing.',
  ai_disclosure   text not null default 'Produced with Claude AI'
);

-- ─── FUNDAMENTALS: EIA Inventories ──────────────────────────
create table if not exists eia_inventories (
  id              bigint generated always as identity primary key,
  report_date     date not null unique,
  value_mb        numeric(10,1) not null,
  change_mb       numeric(10,1) not null,
  five_year_avg_mb numeric(10,1),
  fetched_at      timestamptz not null default now()
);

create index if not exists idx_eia_date
  on eia_inventories (report_date desc);

-- ─── FUNDAMENTALS: Baker Hughes Rig Count ───────────────────
create table if not exists rig_counts (
  id          bigint generated always as identity primary key,
  report_date date not null unique,
  oil_rigs    int not null,
  change      int not null default 0,
  fetched_at  timestamptz not null default now()
);

create index if not exists idx_rig_date
  on rig_counts (report_date desc);

-- ─── FUNDAMENTALS: OPEC Compliance ─────────────────────────
create table if not exists opec_compliance (
  id            bigint generated always as identity primary key,
  report_date   date not null,
  source        text not null default 'OPEC MOMR',
  country       text not null,
  quota_mbd     numeric(5,2) not null,
  estimated_mbd numeric(5,2) not null,
  compliance_pct numeric(5,1) not null,
  fetched_at    timestamptz not null default now(),
  constraint uq_opec_country_date unique (report_date, country)
);

-- ─── FUNDAMENTALS: Refinery Utilization ─────────────────────
create table if not exists refinery_utilization (
  id          bigint generated always as identity primary key,
  report_date date not null unique,
  value_pct   numeric(5,1) not null,
  fetched_at  timestamptz not null default now()
);

create index if not exists idx_refinery_date
  on refinery_utilization (report_date desc);

-- ─── FUNDAMENTALS: US Production ────────────────────────────
create table if not exists us_production (
  id          bigint generated always as identity primary key,
  report_date date not null unique,
  value_mbd   numeric(5,1) not null,
  fetched_at  timestamptz not null default now()
);

create index if not exists idx_production_date
  on us_production (report_date desc);

-- ─── PIPELINE STATUS ────────────────────────────────────────
create table if not exists pipeline_runs (
  id          bigint generated always as identity primary key,
  pipeline    text not null,         -- 'prices', 'news', 'fundamentals', 'brief'
  status      text not null,         -- 'success', 'partial', 'failed'
  message     text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_pipeline_runs
  on pipeline_runs (pipeline, started_at desc);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
-- All tables: public read, service-role write

alter table prices enable row level security;
alter table exchange_rates enable row level security;
alter table spreads enable row level security;
alter table price_history enable row level security;
alter table news_items enable row level security;
alter table energy_briefs enable row level security;
alter table eia_inventories enable row level security;
alter table rig_counts enable row level security;
alter table opec_compliance enable row level security;
alter table refinery_utilization enable row level security;
alter table us_production enable row level security;
alter table pipeline_runs enable row level security;

-- Public read access (anon key can SELECT)
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'prices','exchange_rates','spreads','price_history',
    'news_items','energy_briefs','eia_inventories','rig_counts',
    'opec_compliance','refinery_utilization','us_production','pipeline_runs'
  ])
  loop
    execute format('
      create policy if not exists "public_read_%s" on %I
        for select using (true);
    ', t, t);
  end loop;
end $$;

-- Service-role has full access by default (bypasses RLS)
-- No additional policies needed for writes
