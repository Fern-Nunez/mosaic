import { cookies } from "next/headers"

import { TrendsOverview } from "@/components/app/trends/trends-overview"
import { parseRange } from "@/lib/app/dates"
import { PAGE_TITLE } from "@/lib/app/ui"
import { loadTrendData } from "@/lib/app/trend-data"
import { createClient } from "@/lib/supabase/server"

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const range = parseRange((await searchParams).range)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const workspace = (await cookies()).get("mosaic-workspace")?.value ?? "personal"
  const data = await loadTrendData(supabase, user.id, workspace, range.id)

  return (
    <div className="flex flex-col gap-12">
      <h1 className={`pt-4 ${PAGE_TITLE}`}>
        How things are trending.
      </h1>
      <TrendsOverview data={data} range={range} />
    </div>
  )
}
