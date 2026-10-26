import { cookies } from "next/headers"
import { notFound } from "next/navigation"

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
  const range = parseRange((await searchParams).range)

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
      <header className="flex items-start justify-between gap-4 pt-4">
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
      </header>
      <CategoryDetail category={category} data={data} range={range} />
    </div>
  )
}
