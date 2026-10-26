"use client"

import * as React from "react"
import { ArrowUpRight, BatteryMedium, Briefcase, ChartPie, ChevronLeft, CircleArrowUp, type LucideIcon } from "lucide-react"

import { InsightChartView } from "@/components/app/insight-chart"
import { dateKey } from "@/lib/app/dates"
import type { InsightChart } from "@/lib/app/insight-metrics"
import { PAGE_TITLE } from "@/lib/app/ui"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string; chart?: InsightChart; error?: boolean }

const SUGGESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Briefcase, text: "What do my best days have in common?" },
  { icon: BatteryMedium, text: "Am I happier on days I journal?" },
  { icon: ChartPie, text: "Does sleep affect my spending?" },
]

// Typed into the empty input, one after another. Different from the
// suggestions above it, and only questions the data can actually answer.
const TYPED_IDEAS = [
  "Chart sleep vs. workouts",
  "Do I eat more on gym days?",
  "Graph my weight lately",
  "Moods after good sleep?",
  "Habits on journal days?",
  "Spending on workout days?",
]
const FALLBACK = "Type a question..."

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

/**
 * Types a phrase, holds it with a blinking cursor, deletes it, moves to
 * the next. The cursor stays solid while typing, like a real one.
 */
function useTypewriter(phrases: string[], running: boolean) {
  const [text, setText] = React.useState("")
  const [caret, setCaret] = React.useState(true)
  React.useEffect(() => {
    if (!running) return
    let i = 0
    let pos = 0
    let deleting = false
    let blinks = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const phrase = phrases[i]
      if (!deleting) {
        if (pos >= phrase.length) {
          // Holding: blink four times, then start deleting.
          if (blinks < 4) {
            blinks++
            setCaret(blinks % 2 === 0)
            timer = setTimeout(tick, 450)
            return
          }
          blinks = 0
          setCaret(true)
          deleting = true
          timer = setTimeout(tick, 22)
          return
        }
        pos++
        setText(phrase.slice(0, pos))
        timer = setTimeout(tick, pos >= phrase.length ? 450 : 55)
      } else {
        pos--
        setText(phrase.slice(0, pos))
        if (pos <= 0) {
          deleting = false
          i = (i + 1) % phrases.length
          timer = setTimeout(tick, 400)
        } else timer = setTimeout(tick, 22)
      }
    }
    timer = setTimeout(tick, 500)
    return () => clearTimeout(timer)
  }, [phrases, running])
  return `${text}${caret ? "|" : ""}`
}

/**
 * The on-screen keyboard.
 *  - height: how much shorter the visible screen is than with no keyboard.
 *    Compared against the tallest height seen, not window.innerHeight,
 *    because some phone browsers shrink the whole page with the keyboard
 *    (then innerHeight shrinks too and the keyboard looked like 0px).
 *  - bottom: how far the visible area's bottom sits above the page's
 *    bottom edge, which is where the input gets pinned. 0 when the page
 *    itself shrank; more when Safari scrolled the page up instead.
 */
function useKeyboard(active: boolean) {
  const [kb, setKb] = React.useState({ height: 0, bottom: 0 })
  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let tallest = vv.height
    let width = vv.width
    const update = () => {
      // Rotating the phone changes the "no keyboard" height; start over.
      if (Math.abs(vv.width - width) > 1) {
        width = vv.width
        tallest = vv.height
      }
      tallest = Math.max(tallest, vv.height)
      setKb({
        height: Math.max(0, Math.round(tallest - vv.height)),
        bottom: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
      })
    }
    const frame = requestAnimationFrame(update)
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])
  return active ? kb : { height: 0, bottom: 0 }
}

// Only for browsers that can't measure the keyboard: on a touchscreen,
// a focused box means the keyboard is up. (Where it can be measured, trust
// that instead: Chrome on iPhone keeps the box focused after the keyboard
// is closed, which made this guess wrong.)
const keyboardGuess = () => !window.visualViewport && window.matchMedia("(pointer: coarse)").matches

// Sits just above the tab bar and its round + button (tab-bar.tsx BAR_BOTTOM + bar + gap).
const COMPOSER_BOTTOM = "calc(max(24px, calc(env(safe-area-inset-bottom) + 8px)) + 110px)"

/** The Insights tab: ask questions about everything you've logged. */
export function InsightsChat() {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const endRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [focused, setFocused] = React.useState(false)
  const started = messages.length > 0
  const reduceMotion = React.useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  )
  // Stops the moment you tap in or start typing.
  const typing = !reduceMotion && !focused && !draft
  const typed = useTypewriter(TYPED_IDEAS, typing)
  // Fewer than a week logged: say so up front instead of locking the tab.
  const [loggedDays, setLoggedDays] = React.useState<number | null>(null)
  React.useEffect(() => {
    let live = true
    fetch(`/api/insights?today=${dateKey(new Date())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && typeof j?.loggedDays === "number" && setLoggedDays(j.loggedDays))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  const kb = useKeyboard(focused)
  // A real phone keyboard, not a laptop focusing the box.
  const keyboardOpen = focused && (kb.height > 120 || keyboardGuess())

  /** Top-left < : put the keyboard away, or (mid-chat) go back to the start. */
  function back() {
    if (keyboardOpen) {
      setDraft("")
      inputRef.current?.blur()
      setFocused(false)
      return
    }
    if (!busy) setMessages([])
  }

  // Lets the tab bar hide itself while typing (see tab-bar.tsx).
  React.useEffect(() => {
    const root = document.documentElement
    if (keyboardOpen) root.dataset.keyboard = "open"
    else delete root.dataset.keyboard
    return () => {
      delete root.dataset.keyboard
    }
  }, [keyboardOpen])

  React.useEffect(() => {
    if (started) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy, started, keyboardOpen])

  async function ask(question: string) {
    const text = question.trim()
    if (!text || busy) return
    const history = [...messages.filter((m) => !m.error), { role: "user" as const, content: text }]
    setMessages((m) => [...m, { role: "user", content: text }])
    setDraft("")
    setBusy(true)
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          today: dateKey(new Date()),
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.answer) throw new Error(json.error ?? "Something went wrong. Try again.")
      setMessages((m) => [...m, { role: "assistant", content: json.answer, chart: json.chart }])
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong.", error: true },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Full-screen wash behind everything (Figma: brand green fading to the page gray). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,#318E63_0%,#8DBFA5_38%,#D2E3DA_68%,#EEF0EF_88%)] dark:bg-[linear-gradient(180deg,#1E5E41_0%,#163A2A_35%,#0F1A15_65%,#0B0B0C_90%)]"
      />

      {(keyboardOpen || started) && (
        <button
          type="button"
          // Keep the box focused until the tap lands; otherwise the keyboard
          // closes first, this button disappears, and the tap is lost.
          onPointerDown={(e) => e.preventDefault()}
          onClick={back}
          disabled={busy && !keyboardOpen}
          aria-label={keyboardOpen ? "Close keyboard" : "Back to start"}
          className="fixed left-4 z-40 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/70 text-neutral-800 shadow-sm backdrop-blur active:bg-white disabled:opacity-50 dark:bg-neutral-900/70 dark:text-neutral-200"
          style={{ top: "max(16px, calc(env(safe-area-inset-top) + 8px))" }}
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      <div className="relative">
        {!started ? (
          <div
            className={cn(
              "flex flex-col items-center gap-4 pt-[24svh] text-center transition-opacity duration-200",
              // Out of the way while typing; the suggestions and input need the room.
              keyboardOpen && "pointer-events-none opacity-0"
            )}
          >
            <h1 className={PAGE_TITLE}>
              Let&apos;s look for
              <br />
              some patterns.
            </h1>
            <p className="text-[15px] text-neutral-800 dark:text-neutral-300">Ask about anything you&apos;ve logged.</p>
            {loggedDays !== null && loggedDays < 7 && (
              <p className="max-w-[300px] rounded-xl bg-white/60 px-3 py-2 text-sm text-neutral-700 backdrop-blur dark:bg-neutral-900/60 dark:text-neutral-300">
                {loggedDays === 0
                  ? "Nothing logged yet. Log a few days with + and patterns will start to show up here."
                  : `You've logged ${loggedDays} day${loggedDays === 1 ? "" : "s"} so far. Answers get a lot better after a week or two.`}
              </p>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col gap-3 pt-2 pb-16"
            // Room for the keyboard so the newest message isn't hidden behind it.
            style={keyboardOpen ? { paddingBottom: kb.height + 24 } : undefined}
            aria-live="polite"
          >
            {/* Room for the < button. */}
            <div className="h-10" />
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "max-w-[85%] self-end rounded-br-md bg-[#318E63] text-white"
                    : "self-start rounded-bl-md bg-white/90 text-neutral-900 backdrop-blur dark:bg-neutral-900/90 dark:text-neutral-100",
                  // Charts get the full width; plain answers stay bubble-sized.
                  m.role === "assistant" && (m.chart ? "flex w-full flex-col gap-4" : "max-w-[85%]"),
                  m.error && "text-red-700 dark:text-red-400"
                )}
              >
                {m.content}
                {m.chart && <InsightChartView chart={m.chart} />}
              </div>
            ))}
            {busy && (
              <div className="flex gap-1 self-start rounded-2xl rounded-bl-md bg-white/90 px-4 py-4 dark:bg-neutral-900/90" aria-label="Thinking">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-2 animate-bounce rounded-full bg-neutral-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Suggestions + input, pinned above the tab bar. */}
      <div
        className="fixed inset-x-0 z-40 mx-auto w-full max-w-[440px] px-4"
        style={{ bottom: keyboardOpen ? kb.bottom + 8 : COMPOSER_BOTTOM }}
      >
        {!started && (
          <ul className="mb-3 flex flex-col px-3">
            {SUGGESTIONS.map((s) => (
              <li key={s.text}>
                <button
                  type="button"
                  onClick={() => ask(s.text)}
                  className="flex min-h-9 w-full cursor-pointer items-center gap-2.5 text-left text-sm text-neutral-600 active:opacity-60 dark:text-neutral-400"
                >
                  <s.icon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="flex-1">{s.text}</span>
                  <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(draft)
          }}
          className="flex h-[52px] items-center gap-2 rounded-2xl bg-white pr-2 pl-4 shadow-[0_2px_10px_rgb(0_0_0/0.06)] dark:bg-neutral-900"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={typing ? typed : FALLBACK}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Ask about your data"
            enterKeyHint="send"
            // 16px+ so iPhones don't zoom in on focus.
            className="min-w-0 flex-1 bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Ask"
            className={cn(
              "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
              draft.trim() && !busy ? "text-[#318E63]" : "text-neutral-400 dark:text-neutral-500"
            )}
          >
            <CircleArrowUp className="size-6" strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </>
  )
}
