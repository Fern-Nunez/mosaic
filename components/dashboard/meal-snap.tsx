"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2, RefreshCcw, Sparkles } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { createClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import type { NutritionRow } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "drink", label: "Drink" },
] as const

// How aggressively the AI resolves an ambiguous portion into macros.
const ESTIMATE_LEVELS = [
  { value: "low", label: "Low" },
  { value: "middle", label: "Middle" },
  { value: "high", label: "High" },
] as const

type EstimateLevel = (typeof ESTIMATE_LEVELS)[number]["value"]

type Estimate = {
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  portion_size: string
  notes: string
}

function defaultMealType(): NutritionRow["meal_type"] {
  const hour = new Date().getHours()
  if (hour < 11) return "breakfast"
  if (hour < 16) return "lunch"
  return "dinner"
}

function localDate() {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${month}-${day}`
}

// Phone photos are often 5-12MB; shrink before uploading so analysis
// is fast and cheap. Falls back to the original file if decoding fails
// (e.g. an image format the browser can't draw to canvas).
async function downscale(file: File, maxDim = 1280): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85)
    )
  } catch {
    return file
  }
}

export function MealSnap({ userId }: { userId: string }) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()
  const fileInput = React.useRef<HTMLInputElement>(null)
  const scrollArea = React.useRef<HTMLDivElement>(null)

  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<"photo" | "review">("photo")
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [details, setDetails] = React.useState("")
  const [estimateLevel, setEstimateLevel] = React.useState<EstimateLevel>("low")
  const [analyzing, setAnalyzing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Review-step fields, prefilled by the AI and editable before saving.
  const [foodName, setFoodName] = React.useState("")
  const [calories, setCalories] = React.useState("")
  const [protein, setProtein] = React.useState("")
  const [carbs, setCarbs] = React.useState("")
  const [fat, setFat] = React.useState("")
  const [portion, setPortion] = React.useState("")
  const [mealType, setMealType] = React.useState<string>("dinner")
  const [notes, setNotes] = React.useState("")

  // Start each step at the top — after analysis the sheet may be
  // scrolled down from typing with the keyboard open.
  React.useEffect(() => {
    scrollArea.current?.scrollTo({ top: 0 })
  }, [step])

  function reset() {
    setStep("photo")
    setFile(null)
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url)
      return null
    })
    setName("")
    setDetails("")
    setEstimateLevel("low")
    setError(null)
    setAnalyzing(false)
    setSaving(false)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    // Allow re-picking the same file later.
    event.target.value = ""
    if (!picked) return
    setFile(picked)
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url)
      return URL.createObjectURL(picked)
    })
    setError(null)
    // The picker is the entry point: picking a photo opens the form.
    setOpen(true)
  }

  async function analyze(event: React.FormEvent) {
    event.preventDefault()
    if (!file) return
    setAnalyzing(true)
    setError(null)

    const body = new FormData()
    body.append("image", await downscale(file), "meal.jpg")
    body.append("name", name)
    body.append("details", details)
    body.append("estimate", estimateLevel)

    let estimate: Estimate
    try {
      const res = await fetch("/api/analyze-meal", { method: "POST", body })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Analysis failed.")
      estimate = json as Estimate
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.")
      setAnalyzing(false)
      return
    }

    setFoodName(name.trim() || estimate.food_name)
    setCalories(String(estimate.calories))
    setProtein(String(estimate.protein))
    setCarbs(String(estimate.carbs))
    setFat(String(estimate.fat))
    setPortion(estimate.portion_size)
    setNotes(estimate.notes)
    setMealType(defaultMealType() ?? "dinner")
    setAnalyzing(false)
    setStep("review")
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from("nutrition").insert({
      user_id: userId,
      workspace: active.id,
      date: localDate(),
      meal_type: mealType,
      food_name: foodName.trim(),
      calories: calories ? Math.round(Number(calories)) : null,
      protein: protein ? Number(protein) : null,
      carbs: carbs ? Number(carbs) : null,
      fat: fat ? Number(fat) : null,
      portion_size: portion.trim() || null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  const errorBox = error && (
    <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
      {error}
    </p>
  )

  const photoStep = (
    <form onSubmit={analyze} className="space-y-4">
      <div className="relative overflow-hidden rounded-xl bg-muted">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Your meal"
            className="max-h-64 w-full object-cover"
          />
        )}
        <Button
          type="button"
          variant="secondary"
          size="xs"
          className="absolute right-2 bottom-2 shadow-sm"
          onClick={() => fileInput.current?.click()}
          disabled={analyzing}
        >
          <RefreshCcw className="size-3" />
          Change
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="meal-name">Name it (optional)</Label>
        <Input
          id="meal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Chicken alfredo"
          disabled={analyzing}
          enterKeyHint="next"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="meal-details">What&apos;s in it? (optional)</Label>
        <Textarea
          id="meal-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Chicken breast, fettuccine, alfredo sauce…"
          rows={2}
          disabled={analyzing}
        />
        <p className="text-xs text-muted-foreground">
          The more you tell it, the better the estimate.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Estimate macros on the…</Label>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {ESTIMATE_LEVELS.map((level) => (
            <Button
              key={level.value}
              type="button"
              size="sm"
              variant={estimateLevel === level.value ? "secondary" : "ghost"}
              className={
                estimateLevel === level.value ? "shadow-sm" : "text-muted-foreground"
              }
              onClick={() => setEstimateLevel(level.value)}
              disabled={analyzing}
              aria-pressed={estimateLevel === level.value}
            >
              {level.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Low is conservative; high assumes larger portions.
        </p>
      </div>

      {errorBox}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" className="w-full" disabled={analyzing}>
          {analyzing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Analyzing your meal…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Analyze photo
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => onOpenChange(false)}
          disabled={analyzing}
        >
          Cancel
        </Button>
      </div>
    </form>
  )

  const reviewStep = (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Your meal"
            className="size-14 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="review-name" className="sr-only">
            Food
          </Label>
          <Input
            id="review-name"
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="Food name"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="review-calories">Calories</Label>
          <Input
            id="review-calories"
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-protein">Protein (g)</Label>
          <Input
            id="review-protein"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-carbs">Carbs (g)</Label>
          <Input
            id="review-carbs"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-fat">Fat (g)</Label>
          <Input
            id="review-fat"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="review-portion">Portion</Label>
          <Input
            id="review-portion"
            value={portion}
            onChange={(e) => setPortion(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Meal</Label>
          <Select
            value={mealType}
            onValueChange={(value) => {
              if (value !== null) setMealType(value)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-notes">Notes</Label>
        <Textarea
          id="review-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      {errorBox}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={saving || !foodName.trim()}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save meal"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setStep("photo")}
          disabled={saving}
        >
          Back
        </Button>
      </div>
    </form>
  )

  const heading =
    step === "photo"
      ? {
          title: "Snap a meal",
          description: "AI reads the photo and estimates the macros.",
        }
      : {
          title: "Check the estimate",
          description: "Tweak anything that looks off, then save.",
        }

  const body = (
    <>
      <div className="space-y-1">
        <h2 className="font-heading text-base font-medium">{heading.title}</h2>
        <p className="text-sm text-muted-foreground">{heading.description}</p>
      </div>
      {step === "photo" ? photoStep : reviewStep}
    </>
  )

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickFile}
      />
      {/* The button jumps straight into the camera / photo picker; the
          form opens once a photo is chosen. */}
      <Button onClick={() => fileInput.current?.click()}>
        <Camera className="size-4" />
        Snap a meal
      </Button>

      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[92dvh] gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{heading.title}</SheetTitle>
              <SheetDescription>{heading.description}</SheetDescription>
            </SheetHeader>
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted" />
            <div
              ref={scrollArea}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              {body}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-h-[85dvh] gap-0 overflow-y-auto sm:max-w-md">
            <DialogTitle className="sr-only">{heading.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {heading.description}
            </DialogDescription>
            <div className="space-y-4">{body}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
