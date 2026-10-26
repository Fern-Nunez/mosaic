/**
 * Shown the instant you tap a tab, while the page's data loads. Without this
 * a tap looked like it did nothing, and tapping again restarted the wait.
 */
export default function Loading() {
  const block = "animate-pulse rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70"
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading">
      <div className={`mt-4 h-24 w-3/4 ${block}`} />
      <div className="flex flex-col gap-4">
        <div className={`h-40 ${block}`} />
        <div className={`h-56 ${block}`} />
        <div className={`h-32 ${block}`} />
      </div>
    </div>
  )
}
