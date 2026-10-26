import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { CHART_SPANS, INSIGHT_METRICS, METRIC_IDS, type ChartSpan, type MetricId } from "@/lib/app/insight-metrics"
import { buildChart, buildDays, buildInsightsContext, type HabitsData } from "@/lib/app/insights-context"
import { loadTrendData } from "@/lib/app/trend-data"
import { decryptSecret } from "@/lib/crypto"
import type { Habit } from "@/lib/habits"
import { createClient } from "@/lib/supabase/server"

// Same model as meal photos. OpenAI retires gpt-4o-mini on Jan 14, 2027;
// set OPENAI_INSIGHTS_MODEL in .env.local / Vercel to switch without a code change.
const MODEL = process.env.OPENAI_INSIGHTS_MODEL || "gpt-4o-mini"

const SYSTEM = `You are Mosaic's insights assistant. Mosaic is a personal tracker for money, food, workouts, sleep, weight, journal moods, habits and supplements.

Rules:
- Answer only from the data below. Never invent numbers.
- For "does X affect Y" questions, use the COMPARISONS section; quote both numbers and the day counts.
- If a side has fewer than 7 days, say the sample is small.
- These are patterns, not proof of cause. Say so briefly when it matters, without lecturing.
- If the data can't answer the question, say what they'd need to log, in one sentence.
- Write like a sharp friend: plain sentences, no markdown, no bullet points, no headings. 2 to 5 sentences. No emojis.
- Never give medical, diet or financial advice beyond describing their own data.
- When they ask to see, chart, graph, plot or visually compare things, call show_chart instead of only describing it. Pick the two closest metrics; use 30 days unless they say otherwise (14 for "this week"/"lately", 90 for "months"/"long term").`

type Message = { role: "user" | "assistant"; content: string }

/** The one tool the model gets. It only picks what to chart; the numbers come from buildChart. */
function chartTool(allowed: MetricId[]) {
  return {
    type: "function",
    function: {
      name: "show_chart",
      description: "Show the user a chart of one or two of their metrics over time, built from their real logs.",
      parameters: {
        type: "object",
        properties: {
          metrics: {
            type: "array",
            description: "One or two metrics to chart. First is drawn as the main series.",
            items: { type: "string", enum: allowed },
          },
          days: { type: "integer", enum: [...CHART_SPANS], description: "How far back: 14, 30 or 90 days (90 is shown by week)." },
          caption: {
            type: "string",
            description: "1 to 2 plain sentences on what the chart shows, using numbers from COMPARISONS when they fit. No markdown.",
          },
        },
        required: ["metrics", "days", "caption"],
        additionalProperties: false,
      },
    },
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null
  const messages: Message[] = Array.isArray(body?.messages)
    ? body.messages
        .filter((m: Message) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
        .slice(-8)
        .map((m: Message) => ({ role: m.role, content: m.content.slice(0, 1500) }))
    : []
  if (!today || !messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Missing question." }, { status: 400 })
  }

  // Same key lookup as meal photos: the user's own key, else the server's.
  let apiKey: string | null = null
  const { data: keyRow } = await supabase.from("user_settings").select("openai_api_key").maybeSingle()
  if (keyRow?.openai_api_key) {
    try {
      apiKey = decryptSecret(keyRow.openai_api_key)
    } catch {
      apiKey = null
    }
  }
  apiKey ??= process.env.OPENAI_API_KEY || null
  if (!apiKey) {
    return NextResponse.json(
      { error: "No OpenAI key yet. Add yours in the old dashboard under Settings." },
      { status: 400 }
    )
  }

  const workspace = (await cookies()).get("mosaic-workspace")?.value ?? "personal"
  const [data, habitsRes, completionsRes] = await Promise.all([
    loadTrendData(supabase, user.id, workspace, "q"),
    supabase.from("habits").select("*").eq("workspace", workspace),
    supabase.from("habit_completions").select("habit_id, date").eq("workspace", workspace),
  ])
  const habits: HabitsData = {
    habits: ((habitsRes.data ?? []) as (Habit & { days?: number[] | null })[]).map((h) => ({ ...h, days: h.days ?? null })),
    completions: ((completionsRes.data ?? []) as { habit_id: string; date: string }[]).map((c) => ({ habitId: c.habit_id, date: c.date })),
  }
  const hidden = data.prefs.hiddenSections ?? []
  const context = buildInsightsContext(data, habits, today, hidden)
  const chartable = METRIC_IDS.filter((id) => !hidden.includes(INSIGHT_METRICS[id].section))

  let res: Response
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 350,
        temperature: 0.3,
        messages: [{ role: "system", content: `${SYSTEM}\n\n${context}` }, ...messages],
        ...(chartable.length ? { tools: [chartTool(chartable)], tool_choice: "auto" } : {}),
      }),
    })
  } catch {
    return NextResponse.json({ error: "Couldn't reach OpenAI. Check your connection and try again." }, { status: 502 })
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    return NextResponse.json({ error: err?.error?.message ?? `OpenAI request failed (${res.status}).` }, { status: 502 })
  }
  const completion = await res.json()
  const message = completion.choices?.[0]?.message
  const call = message?.tool_calls?.find((c: { function?: { name?: string } }) => c.function?.name === "show_chart")
  if (call) {
    let args: { metrics?: unknown; days?: unknown; caption?: unknown } = {}
    try {
      args = JSON.parse(call.function.arguments)
    } catch {}
    const metrics = (Array.isArray(args.metrics) ? args.metrics : []).filter((m): m is MetricId => chartable.includes(m as MetricId))
    const span: ChartSpan = CHART_SPANS.includes(args.days as ChartSpan) ? (args.days as ChartSpan) : 30
    const chart = buildChart(buildDays(data, habits, today), metrics, span, hidden)
    const caption = typeof args.caption === "string" ? args.caption.trim() : ""
    if (chart) return NextResponse.json({ answer: caption || message?.content?.trim() || "Here's the chart.", chart })
  }
  const answer: string | undefined = message?.content
  if (!answer) return NextResponse.json({ error: "No answer came back. Try again." }, { status: 502 })
  return NextResponse.json({ answer: answer.trim() })
}

/** How many of the last 90 days have anything logged, for the "not much data yet" note. */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  const today = new URL(request.url).searchParams.get("today")
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return NextResponse.json({ error: "Missing date." }, { status: 400 })

  const workspace = (await cookies()).get("mosaic-workspace")?.value ?? "personal"
  const [data, completionsRes] = await Promise.all([
    loadTrendData(supabase, user.id, workspace, "q"),
    supabase.from("habit_completions").select("habit_id, date").eq("workspace", workspace),
  ])
  const completions = ((completionsRes.data ?? []) as { habit_id: string; date: string }[]).map((c) => ({ habitId: c.habit_id, date: c.date }))
  // Habits only count when one was actually checked off, so no need to load their schedules.
  const days = buildDays(data, { habits: [], completions: [] }, today)
  const checked = new Set(completions.map((c) => c.date))
  const loggedDays = days.filter(
    (d) =>
      d.calories != null || d.spent > 0 || d.fixed > 0 || d.income > 0 || d.workout.length > 0 ||
      d.sleepHours != null || d.journaled || d.weight != null || d.supplements > 0 || checked.has(d.date)
  ).length
  return NextResponse.json({ loggedDays })
}
