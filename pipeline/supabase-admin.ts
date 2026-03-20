/**
 * Server-side Supabase client (uses service role key — bypasses RLS)
 * Only used by pipeline scripts, never by the frontend.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

export const supabaseAdmin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Log a pipeline run start — returns the run ID */
export async function logPipelineStart(pipeline: string) {
  const { data, error } = await supabaseAdmin
    .from('pipeline_runs')
    .insert({ pipeline, status: 'running' })
    .select('id')
    .single()
  if (error) console.error(`Failed to log pipeline start: ${error.message}`)
  return data?.id
}

/** Log a pipeline run completion */
export async function logPipelineEnd(
  runId: number | undefined,
  status: 'success' | 'partial' | 'failed',
  message?: string,
) {
  if (!runId) return
  await supabaseAdmin
    .from('pipeline_runs')
    .update({ status, message, finished_at: new Date().toISOString() })
    .eq('id', runId)
}
