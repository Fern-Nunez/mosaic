import { PAGE_TITLE } from "@/lib/app/ui"

export default function InsightsPage() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 text-center">
      <h1 className={PAGE_TITLE}>
        Let&apos;s look for
        <br />
        some patterns.
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Ask about anything you&apos;ve logged.</p>
      {/* Build Insights here: suggestion chips + chat input. */}
    </div>
  )
}
