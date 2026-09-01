import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and media. Anything not
     * excluded here goes through the auth check, which redirects signed-out
     * requests to /login — that turns a missing extension into an HTML page
     * where a file was expected (this is what broke the login video).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|mov|ogg|mp3|m4a|wav)$).*)",
  ],
}
