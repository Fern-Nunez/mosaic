"use client"

import * as React from "react"
import {
  Briefcase,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import type { JobApplicationRow, JobStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Each stage gets a color identity: a soft tint for the status badge and a
// solid dot for the summary chips. Ordered from earliest to latest in a
// typical pipeline; "rejected"/"ghosted"/"withdrawn" are the dead ends.
const STATUSES = [
  { value: "wishlist", label: "Wishlist", dot: "bg-zinc-400", badge: "bg-zinc-400/15 text-zinc-600 dark:text-zinc-300" },
  { value: "applied", label: "Applied", dot: "bg-sky-500", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { value: "interviewing", label: "Interviewing", dot: "bg-amber-500", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "offer", label: "Offer", dot: "bg-violet-500", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { value: "accepted", label: "Accepted", dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "rejected", label: "Rejected", dot: "bg-rose-500", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { value: "withdrawn", label: "Withdrawn", dot: "bg-stone-500", badge: "bg-stone-500/15 text-stone-600 dark:text-stone-300" },
  { value: "ghosted", label: "Ghosted", dot: "bg-orange-500", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
] as const satisfies ReadonlyArray<{
  value: JobStatus
  label: string
  dot: string
  badge: string
}>

const STATUS_BY_VALUE = new Map(STATUSES.map((s) => [s.value, s]))

function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

// "Jul 27, 2026" for a YYYY-MM-DD key, parsed in local time.
function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// Newest application first, tie-broken by id so order is stable.
function sortJobs(rows: JobApplicationRow[]): JobApplicationRow[] {
  return [...rows].sort(
    (a, b) =>
      b.applied_date.localeCompare(a.applied_date) || b.id.localeCompare(a.id)
  )
}

type Draft = {
  id: string | null
  position_title: string
  company: string
  pay: string
  url: string
  status: JobStatus
  applied_date: string
  description: string
  notes: string
}

function toDraft(row: JobApplicationRow): Draft {
  return {
    id: row.id,
    position_title: row.position_title,
    company: row.company ?? "",
    pay: row.pay ?? "",
    url: row.url ?? "",
    status: row.status,
    applied_date: row.applied_date,
    description: row.description ?? "",
    notes: row.notes ?? "",
  }
}

function newDraft(): Draft {
  return {
    id: null,
    position_title: "",
    company: "",
    pay: "",
    url: "",
    status: "applied",
    applied_date: todayKey(),
    description: "",
    notes: "",
  }
}

function StatusBadge({ status }: { status: JobStatus }) {
  const meta = STATUS_BY_VALUE.get(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta?.badge ?? "bg-muted text-muted-foreground"
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta?.dot ?? "bg-current")} />
      {meta?.label ?? status}
    </span>
  )
}

export function JobsSection({
  jobs: initialJobs,
  userId,
}: {
  jobs: JobApplicationRow[]
  userId: string
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()

  const [jobs, setJobs] = React.useState<JobApplicationRow[]>(() =>
    sortJobs(initialJobs)
  )
  const [filter, setFilter] = React.useState<JobStatus | "all">("all")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(newDraft)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // Count per status, plus the overall total, for the summary chips.
  const counts = React.useMemo(() => {
    const map = new Map<JobStatus, number>()
    for (const job of jobs) map.set(job.status, (map.get(job.status) ?? 0) + 1)
    return map
  }, [jobs])

  const visible =
    filter === "all" ? jobs : jobs.filter((j) => j.status === filter)

  function openNew() {
    setDraft(newDraft())
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(row: JobApplicationRow) {
    setDraft(toDraft(row))
    setError(null)
    setDialogOpen(true)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.position_title.trim()) {
      setError("Give it a position title first.")
      return
    }
    setSaving(true)
    setError(null)

    const fields = {
      position_title: draft.position_title.trim(),
      company: draft.company.trim() || null,
      pay: draft.pay.trim() || null,
      url: draft.url.trim() || null,
      status: draft.status,
      applied_date: draft.applied_date,
      description: draft.description.trim() || null,
      notes: draft.notes.trim() || null,
    }

    if (draft.id) {
      const { data, error: err } = await supabase
        .from("job_applications")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", draft.id)
        .select()
        .single()
      setSaving(false)
      if (err || !data) {
        setError(err?.message ?? "Couldn't save.")
        return
      }
      const saved = data as JobApplicationRow
      setJobs((prev) => sortJobs(prev.map((j) => (j.id === saved.id ? saved : j))))
    } else {
      const { data, error: err } = await supabase
        .from("job_applications")
        .insert({ user_id: userId, workspace: active.id, ...fields })
        .select()
        .single()
      setSaving(false)
      if (err || !data) {
        setError(err?.message ?? "Couldn't save.")
        return
      }
      const saved = data as JobApplicationRow
      setJobs((prev) => sortJobs([saved, ...prev]))
    }
    setDialogOpen(false)
  }

  // Inline status change from the card — no dialog needed to move a role
  // along the pipeline.
  async function changeStatus(row: JobApplicationRow, status: JobStatus) {
    if (status === row.status) return
    const previous = jobs
    setJobs((prev) =>
      prev.map((j) => (j.id === row.id ? { ...j, status } : j))
    )
    const { error: err } = await supabase
      .from("job_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", row.id)
    if (err) setJobs(previous) // roll back on failure
  }

  async function remove(row: JobApplicationRow) {
    setDeletingId(row.id)
    const previous = jobs
    setJobs((prev) => prev.filter((j) => j.id !== row.id))
    const { error: err } = await supabase
      .from("job_applications")
      .delete()
      .eq("id", row.id)
    setDeletingId(null)
    if (err) setJobs(previous)
  }

  const filters: Array<{ value: JobStatus | "all"; label: string; count: number }> =
    [
      { value: "all", label: "All", count: jobs.length },
      ...STATUSES.map((s) => ({
        value: s.value,
        label: s.label,
        count: counts.get(s.value) ?? 0,
      })),
    ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-heading text-sm font-medium text-muted-foreground">
          <Briefcase className="size-4" />
          {jobs.length} {jobs.length === 1 ? "application" : "applications"}
        </h3>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm" onClick={openNew}>
                <Plus className="size-4" />
                Add application
              </Button>
            }
          />
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-lg">
            <DialogHeader className="pb-4">
              <DialogTitle>
                {draft.id ? "Edit application" : "New application"}
              </DialogTitle>
              <DialogDescription>
                {draft.id
                  ? "Update the details or move it along the pipeline."
                  : "Track a role you've applied to."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
              {/* Fields scroll on their own so the footer (and Save) stays
                  pinned even after pasting a long description. */}
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5 pb-1">
                <div className="space-y-2">
                <Label htmlFor="job-title">Position title</Label>
                <Input
                  id="job-title"
                  value={draft.position_title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, position_title: e.target.value }))
                  }
                  placeholder="Frontend Engineer"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="job-company">Company</Label>
                  <Input
                    id="job-company"
                    value={draft.company}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, company: e.target.value }))
                    }
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-pay">Pay</Label>
                  <Input
                    id="job-pay"
                    value={draft.pay}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, pay: e.target.value }))
                    }
                    placeholder="$120k · $45/hr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(value) => {
                      if (value)
                        setDraft((d) => ({ ...d, status: value as JobStatus }))
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <span
                            className={cn("size-2 rounded-full", s.dot)}
                          />
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-date">Applied</Label>
                  <Input
                    id="job-date"
                    type="date"
                    value={draft.applied_date}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, applied_date: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-url">Job posting URL</Label>
                <Input
                  id="job-url"
                  type="url"
                  value={draft.url}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, url: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-description">Description</Label>
                <Textarea
                  id="job-description"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder="Role summary, responsibilities, requirements…"
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-notes">Notes</Label>
                <Textarea
                  id="job-notes"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  placeholder="Recruiter name, referral, next step…"
                  className="min-h-16"
                />
              </div>

                {error && (
                  <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                    {error}
                  </p>
                )}
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !draft.position_title.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : draft.id ? (
                    "Save changes"
                  ) : (
                    "Add application"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const meta =
            f.value === "all" ? null : STATUS_BY_VALUE.get(f.value)
          const isActive = filter === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                isActive
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:text-foreground"
              )}
            >
              {meta && (
                <span className={cn("size-1.5 rounded-full", meta.dot)} />
              )}
              {f.label}
              <span className="tabular-nums opacity-70">{f.count}</span>
            </button>
          )
        })}
      </div>

      {/* Applications */}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Briefcase className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {jobs.length === 0
                ? "No applications yet — add your first one."
                : "Nothing in this stage."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visible.map((job) => (
            <Card key={job.id}>
              <CardHeader className="gap-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {job.position_title}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {[job.company, job.pay].filter(Boolean).join(" · ") ||
                        "—"}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {job.url && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Open job posting"
                        nativeButton={false}
                        render={
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit application"
                      onClick={() => openEdit(job)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete application"
                      disabled={deletingId === job.id}
                      onClick={() => remove(job)}
                    >
                      {deletingId === job.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {job.description && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {job.description}
                  </p>
                )}
                {job.notes && (
                  <p className="line-clamp-2 text-xs text-muted-foreground/80 italic">
                    {job.notes}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Applied {shortDate(job.applied_date)}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={job.status} />
                    <Select
                      value={job.status}
                      onValueChange={(value) => {
                        if (value) changeStatus(job, value as JobStatus)
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Change status">
                        <span className="text-xs text-muted-foreground">
                          Move
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            <span
                              className={cn("size-2 rounded-full", s.dot)}
                            />
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
