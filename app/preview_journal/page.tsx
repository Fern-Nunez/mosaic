import { JournalSection } from "@/components/dashboard/journal-section"
import type { JournalRow } from "@/lib/types"

// TEMPORARY local-only preview of JournalSection with mock data.
const ROWS: JournalRow[] = [
  { id: "1", date: "2026-07-16", title: "Long day", entry: "Work was heavy but I pushed through the gym after.", mood: "tired", tags: null },
  { id: "2", date: "2026-07-15", title: "Big win", entry: "Shipped the feature and hit a protein PR. Feeling on top of it.", mood: "motivated", tags: null },
  { id: "3", date: "2026-07-14", title: "Rough one", entry: "Everything piled up at once.", mood: "stressed", tags: null },
  { id: "4", date: "2026-07-12", title: "Chill Sunday", entry: "Slept in, made a big breakfast, walked the loop.", mood: "happy", tags: null },
  { id: "5", date: "2026-07-10", title: "Meh", entry: "Nothing much happened today.", mood: "neutral", tags: null },
  { id: "6", date: "2026-07-08", title: "Anxious about the deadline", entry: "Couldn't stop thinking about Friday.", mood: "anxious", tags: null },
]

export default function PreviewJournal() {
  return (
    <div className="flex h-screen flex-col p-6">
      <div className="min-h-0 flex-1">
        <JournalSection entries={ROWS} userId="preview" />
      </div>
    </div>
  )
}
