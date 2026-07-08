"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { MoodCount } from "@/lib/stats"
import type { JournalRow } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const moodConfig = {
  count: { label: "Entries", color: "var(--chart-3)" },
} satisfies ChartConfig

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  motivated: "🔥",
  stressed: "😵",
  tired: "😴",
  sad: "😢",
  angry: "😠",
  anxious: "😬",
  neutral: "😐",
  unknown: "❔",
}

export function JournalSection({
  moods,
  recent,
}: {
  moods: MoodCount[]
  recent: JournalRow[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Mood check</CardTitle>
          <CardDescription>Entries by mood, last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {moods.length === 0 ? (
            <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No entries in the last 30 days.
            </p>
          ) : (
            <ChartContainer config={moodConfig} className="h-64 w-full">
              <BarChart
                accessibilityLayer
                data={moods}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="mood"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent entries</CardTitle>
          <CardDescription>Your latest journal entries</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No journal entries yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {recent.map((entry) => (
                <li key={entry.id} className="space-y-1 border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {MOOD_EMOJI[entry.mood ?? "unknown"]}{" "}
                      {entry.title ?? entry.date}
                    </p>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {entry.date}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {entry.entry}
                  </p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
