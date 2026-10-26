// Shared by the /app layout (server) and the theme toggle (client). Lives
// outside any "use client" module so the server gets the real value.

export type Theme = "light" | "dark"

/** Cookie the /app layout reads, so the first paint is already the right theme. */
export const THEME_COOKIE = "mosaic-theme"
