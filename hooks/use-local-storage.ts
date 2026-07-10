import * as React from "react"

// Custom event lets multiple hook instances in the same tab stay in
// sync; the native "storage" event only fires for other tabs.
const STORAGE_EVENT = "mosaic:local-storage"

export function setLocalStorageItem(key: string, value: string) {
  window.localStorage.setItem(key, value)
  window.dispatchEvent(new Event(STORAGE_EVENT))
}

function subscribe(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

export function useLocalStorageItem(key: string): string | null {
  return React.useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => null
  )
}
