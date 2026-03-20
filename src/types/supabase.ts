// Auto-generated types for Supabase schema
// Regenerate with: npx supabase gen types typescript --project-id <id> > src/types/supabase.ts

export interface Database {
  public: {
    Tables: {
      prices: {
        Row: {
          id: number
          commodity: string
          price: number
          change: number
          change_pct: number
          currency: string
          unit: string
          source: string
          sparkline_5d: number[]
          discount_from_brent: number | null
          discount_source: string | null
          discount_updated: string | null
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['prices']['Row'], 'id' | 'fetched_at'> & {
          id?: number
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['prices']['Insert']>
      }
      exchange_rates: {
        Row: {
          id: number
          pair: string
          rate: number
          change_pct: number
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['exchange_rates']['Row'], 'id' | 'fetched_at'> & {
          id?: number
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['exchange_rates']['Insert']>
      }
      spreads: {
        Row: {
          id: number
          spread_name: string
          value: number
          direction: string
          trend_30d: number[]
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['spreads']['Row'], 'id' | 'fetched_at'> & {
          id?: number
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['spreads']['Insert']>
      }
      price_history: {
        Row: {
          id: number
          commodity: string
          date: string
          open: number
          high: number
          low: number
          close: number
          volume: number | null
        }
        Insert: Omit<Database['public']['Tables']['price_history']['Row'], 'id'> & { id?: number }
        Update: Partial<Database['public']['Tables']['price_history']['Insert']>
      }
      news_items: {
        Row: {
          id: string
          title: string
          source: string
          url: string
          published_at: string
          category: string
          ai_summary: string | null
          ai_category_confidence: number
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['news_items']['Row'], 'fetched_at'> & {
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['news_items']['Insert']>
      }
      energy_briefs: {
        Row: {
          id: number
          date: string
          generated_at: string
          headline: string
          market_recap: string
          key_developments: Array<{ item: string; so_what: string }>
          geopolitical_radar: string
          desk_implications: string[]
          data_watch: Array<{ date: string; event: string; relevance: string }>
          author: string
          product: string
          ai_disclosure: string
        }
        Insert: Omit<Database['public']['Tables']['energy_briefs']['Row'], 'id' | 'generated_at'> & {
          id?: number
          generated_at?: string
        }
        Update: Partial<Database['public']['Tables']['energy_briefs']['Insert']>
      }
      eia_inventories: {
        Row: {
          id: number
          report_date: string
          value_mb: number
          change_mb: number
          five_year_avg_mb: number | null
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['eia_inventories']['Row'], 'id' | 'fetched_at'> & {
          id?: number
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['eia_inventories']['Insert']>
      }
      rig_counts: {
        Row: {
          id: number
          report_date: string
          oil_rigs: number
          change: number
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['rig_counts']['Row'], 'id' | 'fetched_at'> & {
          id?: number
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['rig_counts']['Insert']>
      }
      opec_compliance: {
        Row: {
          id: number
          report_date: string
          source: string
          country: string
          quota_mbd: number
          estimated_mbd: number
          compliance_pct: number
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['opec_compliance']['Row'], 'id' | 'fetched_at'> & {
          id?: number
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['opec_compliance']['Insert']>
      }
      refinery_utilization: {
        Row: {
          id: number
          report_date: string
          value_pct: number
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['refinery_utilization']['Row'], 'id' | 'fetched_at'> & {
          id?: number
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['refinery_utilization']['Insert']>
      }
      us_production: {
        Row: {
          id: number
          report_date: string
          value_mbd: number
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['us_production']['Row'], 'id' | 'fetched_at'> & {
          id?: number
          fetched_at?: string
        }
        Update: Partial<Database['public']['Tables']['us_production']['Insert']>
      }
      pipeline_runs: {
        Row: {
          id: number
          pipeline: string
          status: string
          message: string | null
          started_at: string
          finished_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['pipeline_runs']['Row'], 'id' | 'started_at'> & {
          id?: number
          started_at?: string
        }
        Update: Partial<Database['public']['Tables']['pipeline_runs']['Insert']>
      }
    }
  }
}
