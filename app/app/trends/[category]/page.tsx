import { cookies } from "next/headers"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { CategoryDetail } from "@/components/app/trends/category-detail"
import { CategorySettings } from "@/components/app/trends/category-settings"
import { CATEGORY_META } from "@/components/app/trends/meta"
import { parseRange } from "@/lib/app/dates"
import { PAGE_TITLE } from "@/lib/app/ui"
import { isTrendCategory, loadTrendData } from "@/lib/app/trend-data"
import { createClient } from "@/lib/supabase/server"

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { category } = await params
  if (!isTrendCategory(category)) notFound()
  const query = await searchParams
  const range = parseRange(query.range)
  // Cards on Today link here with ?from=today; everything else came from Trends.
  const fromToday = query.from === "today"
  const back = fromToday
    ? { href: "/app", label: "Back to Today" }
    : { href: `/app/trends?range=${range.id}`, label: "Back to Trends" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const workspace = (await cookies()).get("mosaic-workspace")?.value ?? "personal"
  const data = await loadTrendData(supabase, user.id, workspace, range.id, category)
  const meta = CATEGORY_META[category]

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        {/* Same spot, size and color as the date on Today. */}
        <Link
          href={back.href}
          className="-ml-1 flex h-5 w-fit items-center gap-0.5 text-sm text-neutral-500 active:opacity-60 dark:text-neutral-400"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
        <div className="flex items-start justify-between gap-4">
        <h1 className={PAGE_TITLE}>{meta.title}</h1>
        <CategorySettings
          category={category}
          userId={user.id}
          data={{
            prefs: data.prefs,
            prefsReady: data.prefsReady,
            goals: data.goals,
            estimateLevel: data.estimateLevel,
            stack: data.stack,
          }}
        />
        </div>
      </header>
      <CategoryDetail category={category} data={data} range={range} keep={fromToday ? "from=today" : undefined} />
    </div>
  )
}
