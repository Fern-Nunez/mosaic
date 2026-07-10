"use client"

import * as React from "react"
import { ListTodo, NotebookPen, PanelRight, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import { createClient } from "@/lib/supabase/client"

type Todo = { id: string; text: string; done: boolean }

const NOTE_SAVE_DELAY_MS = 600
const PANEL_COOKIE_NAME = "scratch_panel_state"
const PANEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
// Matches the `xl:` breakpoint where the inline aside becomes visible.
const DESKTOP_QUERY = "(min-width: 1280px)"

type ScratchPanelContextValue = {
  open: boolean
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  toggle: () => void
  todos: Todo[]
  notes: string
  loadError: boolean
  setNotes: (notes: string) => void
  addTodo: (text: string) => void
  toggleTodo: (id: string, done: boolean) => void
  removeTodo: (id: string) => void
  clearDone: () => void
}

const ScratchPanelContext =
  React.createContext<ScratchPanelContextValue | null>(null)

function useScratchPanel() {
  const context = React.useContext(ScratchPanelContext)
  if (!context) {
    throw new Error(
      "useScratchPanel must be used within a ScratchPanelProvider."
    )
  }
  return context
}

function subscribeToDesktop(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function useIsDesktop() {
  return React.useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  )
}

export function ScratchPanelProvider({
  defaultOpen = true,
  userId,
  children,
}: {
  defaultOpen?: boolean
  userId: string
  children: React.ReactNode
}) {
  const isDesktop = useIsDesktop()
  const { active } = useWorkspace()
  const workspace = active.id
  const supabase = React.useMemo(() => createClient(), [])
  const [open, setOpen] = React.useState(defaultOpen)
  const [openMobile, setOpenMobile] = React.useState(false)
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [notes, setNotesState] = React.useState("")
  const [loadError, setLoadError] = React.useState(false)
  const noteSaveTimeout = React.useRef<number | null>(null)

  // Reload from Supabase whenever the active workspace changes.
  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from("todos")
        .select("id, text, done")
        .eq("workspace", workspace)
        .order("created_at", { ascending: true }),
      supabase
        .from("notes")
        .select("content")
        .eq("workspace", workspace)
        .maybeSingle(),
    ]).then(([todosRes, noteRes]) => {
      if (cancelled) return
      if (todosRes.error || noteRes.error) {
        setLoadError(true)
        setTodos([])
        setNotesState("")
        return
      }
      setLoadError(false)
      setTodos((todosRes.data ?? []) as Todo[])
      setNotesState(noteRes.data?.content ?? "")
    })
    return () => {
      cancelled = true
    }
  }, [supabase, workspace])

  const toggle = React.useCallback(() => {
    if (isDesktop) {
      setOpen((prev) => {
        document.cookie = `${PANEL_COOKIE_NAME}=${!prev}; path=/; max-age=${PANEL_COOKIE_MAX_AGE}`
        return !prev
      })
    } else {
      setOpenMobile((prev) => !prev)
    }
  }, [isDesktop])

  const value = React.useMemo<ScratchPanelContextValue>(() => {
    // Optimistic updates: apply locally right away, revert if the
    // Supabase write fails.
    const revertOnError = (previous: Todo[]) => (error: unknown) => {
      if (error) setTodos(previous)
    }
    return {
      open,
      openMobile,
      setOpenMobile,
      toggle,
      todos,
      notes,
      loadError,
      setNotes: (next) => {
        setNotesState(next)
        if (noteSaveTimeout.current) {
          window.clearTimeout(noteSaveTimeout.current)
        }
        noteSaveTimeout.current = window.setTimeout(() => {
          supabase
            .from("notes")
            .upsert(
              {
                user_id: userId,
                workspace,
                content: next,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,workspace" }
            )
            .then(({ error }) => {
              if (error) setLoadError(true)
            })
        }, NOTE_SAVE_DELAY_MS)
      },
      addTodo: (text) => {
        const todo = { id: crypto.randomUUID(), text, done: false }
        setTodos([...todos, todo])
        supabase
          .from("todos")
          .insert({ ...todo, user_id: userId, workspace })
          .then(({ error }) => revertOnError(todos)(error))
      },
      toggleTodo: (id, done) => {
        setTodos(
          todos.map((todo) => (todo.id === id ? { ...todo, done } : todo))
        )
        supabase
          .from("todos")
          .update({ done })
          .eq("id", id)
          .then(({ error }) => revertOnError(todos)(error))
      },
      removeTodo: (id) => {
        setTodos(todos.filter((todo) => todo.id !== id))
        supabase
          .from("todos")
          .delete()
          .eq("id", id)
          .then(({ error }) => revertOnError(todos)(error))
      },
      clearDone: () => {
        setTodos(todos.filter((todo) => !todo.done))
        supabase
          .from("todos")
          .delete()
          .eq("workspace", workspace)
          .eq("done", true)
          .then(({ error }) => revertOnError(todos)(error))
      },
    }
  }, [open, openMobile, toggle, todos, notes, loadError, supabase, userId, workspace])

  return (
    <ScratchPanelContext.Provider value={value}>
      {children}
    </ScratchPanelContext.Provider>
  )
}

export function ScratchPanelTrigger({ className }: { className?: string }) {
  const { toggle } = useScratchPanel()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={toggle}
    >
      <PanelRight />
      <span className="sr-only">Toggle scratchpad</span>
    </Button>
  )
}

export function ScratchPanel() {
  const { open, openMobile, setOpenMobile } = useScratchPanel()

  return (
    <>
      {open && (
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-80 shrink-0 self-start border-l bg-background xl:block">
          <ScratchPanelContent />
        </aside>
      )}

      {/* Below xl the panel opens as a sheet from the right instead. */}
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="right" className="w-80 gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Scratchpad</SheetTitle>
            <SheetDescription>Quick to-dos and notes.</SheetDescription>
          </SheetHeader>
          <ScratchPanelContent />
        </SheetContent>
      </Sheet>
    </>
  )
}

function ScratchPanelContent() {
  const {
    todos,
    notes,
    loadError,
    setNotes,
    addTodo,
    toggleTodo,
    removeTodo,
    clearDone,
  } = useScratchPanel()
  const [draft, setDraft] = React.useState("")

  function submitTodo(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    addTodo(text)
    setDraft("")
  }

  const doneCount = todos.filter((todo) => todo.done).length

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Scratchpad</h2>
        <p className="text-xs text-muted-foreground">
          Quick to-dos and notes, always here.
        </p>
      </div>

      {loadError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          Couldn&apos;t sync the scratchpad. If this is your first time here,
          run the migration in supabase/migrations/20260709_scratchpad.sql.
        </p>
      )}

      <Tabs defaultValue="todos" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="todos">
            <ListTodo data-icon="inline-start" className="size-4" />
            To-dos
          </TabsTrigger>
          <TabsTrigger value="notes">
            <NotebookPen data-icon="inline-start" className="size-4" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="todos"
          className="mt-3 flex min-h-0 flex-1 flex-col gap-3"
        >
          <form onSubmit={submitTodo} className="flex gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a to-do…"
              aria-label="New to-do"
              className="h-8"
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              className="size-8 shrink-0"
              disabled={!draft.trim()}
              aria-label="Add to-do"
            >
              <Plus className="size-4" />
            </Button>
          </form>

          <ScrollArea className="min-h-0 flex-1">
            {todos.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nothing here yet — add your first to-do.
              </p>
            ) : (
              <ul className="space-y-1 pr-2">
                {todos.map((todo) => (
                  <li
                    key={todo.id}
                    className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={todo.done}
                      onCheckedChange={(checked) =>
                        toggleTodo(todo.id, checked === true)
                      }
                      aria-label={`Mark "${todo.text}" as ${todo.done ? "not done" : "done"}`}
                    />
                    <span
                      className={
                        todo.done
                          ? "min-w-0 flex-1 truncate text-sm text-muted-foreground line-through"
                          : "min-w-0 flex-1 truncate text-sm"
                      }
                    >
                      {todo.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTodo(todo.id)}
                      className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Delete "${todo.text}"`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          {doneCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-xs text-muted-foreground"
              onClick={clearDone}
            >
              Clear {doneCount} done
            </Button>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-3 flex min-h-0 flex-1">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Jot something down…"
            aria-label="Notes"
            className="h-full flex-1 resize-none"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
