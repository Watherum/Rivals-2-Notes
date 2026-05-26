import { useEffect, useRef } from 'react'

const INTERVAL_MS = 60_000

export function useVersionCheck() {
  const baseline = useRef(null)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/version')
        if (!res.ok) return
        const { v } = await res.json()
        if (baseline.current === null) {
          baseline.current = v
        } else if (baseline.current !== v) {
          window.location.reload()
        }
      } catch {
        // network error — ignore, try again next interval
      }
    }

    check()
    const id = setInterval(check, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
