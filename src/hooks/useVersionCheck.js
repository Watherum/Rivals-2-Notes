import { useEffect } from 'react'

const INTERVAL_MS = 60_000

export function useVersionCheck() {
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/version')
        if (!res.ok) return
        const { v } = await res.json()
        if (v !== __APP_VERSION__) {
          window.location.reload()
        }
      } catch {
        // network error — ignore, try again next interval
      }
    }

    const id = setInterval(check, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
