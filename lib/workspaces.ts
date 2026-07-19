// Shared between server components (dashboard layout/page) and the client
// workspace context. Lives outside any "use client" module so server code
// gets the real values, not client-reference proxies.

export type Workspace = { id: string; name: string }

export const DEFAULT_WORKSPACES: Workspace[] = [
  { id: "personal", name: "Personal" },
]
