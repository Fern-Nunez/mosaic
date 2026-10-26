import "server-only"

import { createClient } from "@supabase/supabase-js"

/**
 * Service-role client: skips row level security. Only for jobs that run
 * with nobody signed in (the daily reminder). Never import this into
 * anything that runs in the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
