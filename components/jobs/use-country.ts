'use client'

import { useCallback, useEffect, useState } from 'react'

const KEY = 'devrel.jobs.country'

export function useCountry(preferred?: string): [string | undefined, (code: string | undefined) => void] {
  const [country, setCountry] = useState<string | undefined>(preferred)

  useEffect(() => {
    if (preferred) {
      setCountry(preferred)
      return
    }
    try {
      const stored = window.localStorage.getItem(KEY)
      if (stored) setCountry(stored)
    } catch {}
  }, [preferred])

  const update = useCallback((code: string | undefined) => {
    setCountry(code)
    try {
      if (code) window.localStorage.setItem(KEY, code)
      else window.localStorage.removeItem(KEY)
    } catch {}
  }, [])

  return [country, update]
}
