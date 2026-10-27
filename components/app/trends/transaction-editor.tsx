"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"

import { MoneyForm, type EditableTransaction } from "@/components/app/log/forms"
import { usePrefs } from "@/components/app/prefs-context"
import { useToday } from "@/components/app/use-today"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"

/**
 * Bottom sheet for changing or deleting a saved transaction. Same form as
 * logging money, filled in, with a Delete button under Save.
 */
export function TransactionEditor({
  transaction,
  onClose,
}: {
  transaction: EditableTransaction | null
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()
  const { userId } = usePrefs()
  const today = useToday()
  const sheetRef = React.useRef<HTMLDivElement>(null)
  // Keep the last one on screen while the sheet slides closed.
  const [shown, setShown] = React.useState<EditableTransaction | null>(transaction)
  if (transaction && transaction !== shown) setShown(transaction)

  return (
    <Sheet open={transaction !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        initialFocus={sheetRef}
        ref={sheetRef}
        tabIndex={-1}
        className="mx-auto max-h-[92svh] max-w-[440px] gap-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-3xl border-0 bg-white px-5 pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="mb-5 flex items-center gap-3 pr-10">
          <Pencil className="size-5 text-[#318E63]" />
          <SheetTitle className="text-lg font-semibold">Edit transaction</SheetTitle>
          <SheetDescription className="sr-only">Change the details, or delete it.</SheetDescription>
        </div>
        {shown && today && (
          <MoneyForm
            key={shown.id}
            existing={shown}
            ctx={{
              supabase,
              userId,
              workspace: active.id,
              today,
              done: () => {
                onClose()
                router.refresh()
              },
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
