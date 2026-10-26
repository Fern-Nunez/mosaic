"use client"

import { Moon } from "lucide-react"

import { useTheme } from "@/components/app/theme"
import { Switch } from "@/components/ui/switch"

/** "Dark mode" row for the More tab. The whole row is the tap target. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const dark = theme === "dark"

  return (
    <label className={className}>
      <Moon className="size-5 text-neutral-500 dark:text-neutral-400" />
      <span className="flex-1">Dark mode</span>
      <Switch
        checked={dark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Dark mode"
        className="data-checked:bg-[#318E63]"
      />
    </label>
  )
}
