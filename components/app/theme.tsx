"use client"

import * as React from "react"

import { THEME_COOKIE, type Theme } from "@/lib/theme"
import { cn } from "@/lib/utils"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeRoot.")
  return context
}

/**
 * Wraps the whole /app area. Adding the `dark` class here flips every
 * `dark:` style below it, plus the shadcn color tokens (globals.css keys
 * them off `:root:has(.dark)`), so menus and charts follow along.
 */
export function ThemeRoot({
  initialTheme,
  className,
  style,
  children,
}: {
  initialTheme: Theme
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme)

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        setThemeState(next)
        document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      },
    }),
    [theme]
  )

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={cn(theme === "dark" && "dark", "[color-scheme:light] dark:[color-scheme:dark]", className)}
        style={style}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
