"use client"

import * as React from "react"
import { Check, Copy, Crown, Loader2, LogIn, Plus, Trophy, UserMinus } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { formatPace } from "@/components/dashboard/running-section"
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

type Group = {
  id: string
  name: string
  code: string
  created_by: string
}

type Member = { user_id: string; nickname: string }

type StatRow = {
  user_id: string
  nickname: string
  kind:
    | "lift_max"
    | "lift_1rm"
    | "bw_reps"
    | "workouts_week"
    | "miles_month"
    | "run_longest"
    | "run_pace"
  key: string | null
  label: string | null
  value: number
}

type Entry = { userId: string; nickname: string; value: number; extra?: string }

type Board = {
  id: string
  title: string
  subtitle: string
  entries: Entry[]
  format: (value: number) => string
}

const LIFTS_SHOWN = 9

// Plain-language board titles, and whether lower wins.
const TOTALS: {
  kind: StatRow["kind"]
  title: string
  subtitle: string
  lowerWins?: boolean
  format: (v: number) => string
}[] = [
  {
    kind: "workouts_week",
    title: "Most workouts",
    subtitle: "Lifting days this week",
    format: (v) => `${v} ${v === 1 ? "day" : "days"}`,
  },
  {
    kind: "miles_month",
    title: "Most miles",
    subtitle: "Running, this month",
    format: (v) => `${v} mi`,
  },
  {
    kind: "run_longest",
    title: "Longest run",
    subtitle: "Single run, all time",
    format: (v) => `${v} mi`,
  },
  {
    kind: "run_pace",
    title: "Fastest pace",
    subtitle: "Average pace on a run of 1+ mile",
    lowerWins: true,
    format: (v) => formatPace(v),
  },
]

function rank(entries: Entry[], lowerWins = false) {
  return [...entries].sort((a, b) =>
    lowerWins ? a.value - b.value : b.value - a.value
  )
}

/** Turn the flat stat rows into ranked boards. */
function buildBoards(stats: StatRow[]): { totals: Board[]; lifts: Board[] } {
  const totals = TOTALS.flatMap((t) => {
    const entries = stats
      .filter((s) => s.kind === t.kind)
      .map((s) => ({ userId: s.user_id, nickname: s.nickname, value: Number(s.value) }))
    if (entries.length === 0) return []
    return [
      {
        id: t.kind,
        title: t.title,
        subtitle: t.subtitle,
        entries: rank(entries, t.lowerWins),
        format: t.format,
      },
    ]
  })

  // One board per exercise: heaviest weight, with the est. 1RM alongside.
  const byExercise = new Map<string, { label: string; kind: "lift" | "bw"; rows: StatRow[] }>()
  for (const s of stats) {
    if (!s.key || (s.kind !== "lift_max" && s.kind !== "bw_reps")) continue
    const id = `${s.kind}:${s.key}`
    const cur = byExercise.get(id) ?? {
      label: s.label ?? s.key,
      kind: s.kind === "lift_max" ? "lift" : "bw",
      rows: [],
    }
    cur.rows.push(s)
    byExercise.set(id, cur)
  }
  const oneRm = new Map(
    stats
      .filter((s) => s.kind === "lift_1rm")
      .map((s) => [`${s.user_id}:${s.key}`, Number(s.value)])
  )

  const lifts = [...byExercise.entries()]
    // Exercises more of the group does come first — that's the competition.
    .sort((a, b) => b[1].rows.length - a[1].rows.length || a[1].label.localeCompare(b[1].label))
    .map(([id, ex]) => {
      const entries = ex.rows.map((s) => {
        const est = oneRm.get(`${s.user_id}:${s.key}`)
        return {
          userId: s.user_id,
          nickname: s.nickname,
          value: Number(s.value),
          extra:
            ex.kind === "lift" && est && Math.round(est) !== Math.round(Number(s.value))
              ? `est. 1RM ${Math.round(est)}`
              : undefined,
        }
      })
      return {
        id,
        title: ex.label,
        subtitle: ex.kind === "lift" ? "Heaviest lift" : "Most reps in a set",
        entries: rank(entries),
        format: ex.kind === "lift" ? (v: number) => `${Math.round(v)} lbs` : (v: number) => `${v} reps`,
      }
    })

  return { totals, lifts }
}

export function LeaderboardSection({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), [])

  const [groups, setGroups] = React.useState<Group[] | null>(null)
  const [loadError, setLoadError] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  // Tagged with its group, so switching groups shows a spinner until the
  // new group's data lands instead of the old group's.
  const [loaded, setLoaded] = React.useState<{
    groupId: string
    members: Member[]
    stats: StatRow[]
  } | null>(null)
  const [showAllLifts, setShowAllLifts] = React.useState(false)

  const loadGroups = React.useCallback(
    async (select?: string) => {
      const { data, error } = await supabase
        .from("gym_group_members")
        .select("group:gym_groups(id, name, code, created_by)")
        .eq("user_id", userId)
      if (error) {
        setLoadError(true)
        setGroups([])
        return
      }
      const list = (data ?? [])
        .map((row) => row.group as unknown as Group | null)
        .filter((g): g is Group => g != null)
        .sort((a, b) => a.name.localeCompare(b.name))
      setGroups(list)
      setActiveId((cur) =>
        select && list.some((g) => g.id === select)
          ? select
          : cur && list.some((g) => g.id === cur)
            ? cur
            : (list[0]?.id ?? null)
      )
    },
    [supabase, userId]
  )

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    loadGroups()
  }, [loadGroups])

  React.useEffect(() => {
    if (!activeId) return
    let cancelled = false
    Promise.all([
      supabase
        .from("gym_group_members")
        .select("user_id, nickname")
        .eq("group_id", activeId)
        .order("joined_at", { ascending: true }),
      supabase.rpc("gym_group_leaderboard", { p_group: activeId }),
    ]).then(([m, s]) => {
      if (cancelled) return
      setLoaded({
        groupId: activeId,
        members: (m.data ?? []) as Member[],
        stats: (s.data ?? []) as StatRow[],
      })
    })
    return () => {
      cancelled = true
    }
  }, [supabase, activeId])

  const active = groups?.find((g) => g.id === activeId) ?? null
  const current = loaded && loaded.groupId === activeId ? loaded : null
  const members = current?.members ?? []
  const stats = current?.stats ?? null
  const boards = React.useMemo(() => buildBoards(stats ?? []), [stats])
  const lifts = showAllLifts ? boards.lifts : boards.lifts.slice(0, LIFTS_SHOWN)

  const removeMember = async (memberId: string) => {
    if (!active) return
    const { error } = await supabase
      .from("gym_group_members")
      .delete()
      .eq("group_id", active.id)
      .eq("user_id", memberId)
    if (error) return
    if (memberId === userId) {
      await loadGroups()
    } else {
      setLoaded((cur) =>
        cur && {
          ...cur,
          members: cur.members.filter((m) => m.user_id !== memberId),
          stats: cur.stats.filter((st) => st.user_id !== memberId),
        }
      )
    }
  }

  if (groups === null) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Leaderboards need the database update in{" "}
          <code className="text-foreground">
            supabase/migrations/20260910_running_and_gym_groups.sql
          </code>
          . Run it in the Supabase SQL editor, then reload.
        </CardContent>
      </Card>
    )
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <GroupDialog mode="join" onDone={(id) => loadGroups(id)} />
      <GroupDialog mode="create" onDone={(id) => loadGroups(id)} />
    </div>
  )

  if (!active) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Trophy className="size-5" />
          </span>
          <div className="grid gap-1">
            <p className="font-medium">No groups yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create a group and share its code, or join one with a code a
              friend sent you. Members see each other&apos;s bests — never
              your full log.
            </p>
          </div>
          {actions}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={active.id}
            onValueChange={(v) => {
              if (v) setActiveId(v)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue>
                {(v: string) => groups.find((g) => g.id === v)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CopyCode code={active.code} />
        </div>
        {actions}
      </div>

      {stats === null ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : boards.totals.length === 0 && boards.lifts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nobody in {active.name} has logged a lift or run yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {boards.totals.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {boards.totals.map((b) => (
                <BoardCard key={b.id} board={b} userId={userId} />
              ))}
            </div>
          )}

          {boards.lifts.length > 0 && (
            <div className="grid gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Lifts</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {lifts.map((b) => (
                  <BoardCard key={b.id} board={b} userId={userId} />
                ))}
              </div>
              {boards.lifts.length > LIFTS_SHOWN && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-self-center"
                  onClick={() => setShowAllLifts((v) => !v)}
                >
                  {showAllLifts
                    ? "Show fewer"
                    : `Show all ${boards.lifts.length} exercises`}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length} in {active.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {members.map((m) => {
              const isMe = m.user_id === userId
              const isCreator = m.user_id === active.created_by
              return (
                <li key={m.user_id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1 truncate">
                    {m.nickname}
                    {isMe && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                  {isCreator && (
                    <span className="text-xs text-muted-foreground">Creator</span>
                  )}
                  {isMe ? (
                    <Button variant="ghost" size="xs" onClick={() => removeMember(m.user_id)}>
                      Leave
                    </Button>
                  ) : (
                    active.created_by === userId && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${m.nickname}`}
                        onClick={() => removeMember(m.user_id)}
                      >
                        <UserMinus />
                      </Button>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function BoardCard({ board, userId }: { board: Board; userId: string }) {
  const [leader, ...rest] = board.entries
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="capitalize">{board.title}</CardTitle>
        <CardDescription>{board.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-3 rounded-lg border bg-background/40 p-3">
          <Crown className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {leader.nickname}
              {leader.userId === userId && (
                <span className="font-normal text-muted-foreground"> (you)</span>
              )}
            </p>
            {leader.extra && (
              <p className="text-xs text-muted-foreground">{leader.extra}</p>
            )}
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums">
            {board.format(leader.value)}
          </p>
        </div>
        {rest.length > 0 && (
          <ol className="grid gap-1.5 text-sm">
            {rest.map((e, i) => (
              <li key={e.userId} className="flex items-center gap-3">
                <span className="w-4 text-xs text-muted-foreground tabular-nums">
                  {i + 2}
                </span>
                <span
                  className={cn(
                    "flex-1 truncate",
                    e.userId === userId ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {e.nickname}
                  {e.userId === userId && " (you)"}
                </span>
                <span className="shrink-0 tabular-nums">{board.format(e.value)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className="font-mono tracking-widest"
      onClick={() => {
        navigator.clipboard.writeText(code).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      aria-label={`Copy group code ${code}`}
    >
      {code}
      {copied ? <Check className="text-primary" /> : <Copy />}
    </Button>
  )
}

function GroupDialog({
  mode,
  onDone,
}: {
  mode: "create" | "join"
  onDone: (groupId: string) => void
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [field, setField] = React.useState("")
  const [nickname, setNickname] = React.useState("")

  const isCreate = mode === "create"

  const submit = async () => {
    if (!field.trim()) {
      setError(isCreate ? "Give the group a name." : "Enter the group's code.")
      return
    }
    if (!nickname.trim()) {
      setError("Pick a nickname for this group.")
      return
    }
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = isCreate
      ? await supabase.rpc("create_gym_group", { p_name: field, p_nickname: nickname })
      : await supabase.rpc("join_gym_group", { p_code: field, p_nickname: nickname })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setField("")
    setNickname("")
    setOpen(false)
    onDone((data as Group).id)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant={isCreate ? "default" : "outline"}>
            {isCreate ? <Plus /> : <LogIn />}
            {isCreate ? "Create group" : "Join with code"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create a group" : "Join a group"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "You'll get a code to share. Anyone with it can join."
              : "Enter the 6-character code someone shared with you."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`group-${mode}-field`}>
              {isCreate ? "Group name" : "Code"}
            </Label>
            <Input
              id={`group-${mode}-field`}
              value={field}
              maxLength={isCreate ? 60 : 6}
              placeholder={isCreate ? "Morning lifters" : "ABC123"}
              className={cn(!isCreate && "font-mono tracking-widest uppercase")}
              onChange={(e) => setField(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`group-${mode}-nickname`}>Your nickname in this group</Label>
            <Input
              id={`group-${mode}-nickname`}
              value={nickname}
              maxLength={40}
              placeholder="What the group calls you"
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {isCreate ? "Create" : "Join"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
