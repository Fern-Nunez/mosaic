import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest } from "next/server"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

// Only follow same-app paths so the email link can't bounce users to
// another site.
function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const code = searchParams.get("code")
  const next = safeNext(searchParams.get("next"))

  const supabase = await createClient()
  let reason = "No token or code was present in the link."

  // Token-hash style links (custom Supabase email templates).
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirect(
        next ?? (type === "recovery" ? "/change-password" : "/dashboard")
      )
    }
    reason = error.message
  }

  // Code style links (default Supabase email templates verify on
  // Supabase's end, then land here with ?code=).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      redirect(next ?? "/dashboard")
    }
    reason = error.message
  }

  redirect(`/login?error=${encodeURIComponent(reason)}`)
}
