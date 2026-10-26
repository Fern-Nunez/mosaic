import type { AppPrefs } from "@/lib/app/prefs"
import { createClient } from "@/lib/supabase/client"

/** Merge changes into user_settings.app_prefs without dropping other keys. */
export async function savePrefs(userId: string, patch: AppPrefs): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle()
  const current = (data?.app_prefs as AppPrefs | undefined) ?? {}
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, app_prefs: { ...current, ...patch } }, { onConflict: "user_id" })
  if (!error) return null
  return /app_prefs|schema cache|column/i.test(error.message)
    ? "Run the settings SQL in Supabase first, then try again."
    : error.message
}
