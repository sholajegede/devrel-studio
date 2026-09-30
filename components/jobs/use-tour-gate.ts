'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { track } from '@/lib/jobs/track'
import {
  EMPTY_MEMORY,
  readBrowserMemory,
  shouldAutoStart,
  writeBrowserMemory,
  type TourId,
  type TourMemory,
} from '@/lib/tour-memory'

/**
 * Decides whether a tour may start by itself, and records what happened in the
 * three places that remember: this browser, the account, and the server's
 * hashed-IP copy. The Tour button bypasses the decision.
 */
export function useTourGate(tour: TourId) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const account = useQuery(api.tours.mine, isAuthenticated ? { tour } : 'skip')
  const markAccount = useMutation(api.tours.mark)

  const [browser, setBrowser] = useState<TourMemory | null>(null)
  const [ip, setIp] = useState<TourMemory | null>(null)

  useEffect(() => {
    setBrowser(readBrowserMemory(tour))
    let cancelled = false
    fetch(`/api/tours?tour=${tour}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : EMPTY_MEMORY))
      .then((data: TourMemory) => !cancelled && setIp({ runs: data.runs ?? 0, done: data.done === true }))
      .catch(() => !cancelled && setIp(EMPTY_MEMORY))
    return () => {
      cancelled = true
    }
  }, [tour])

  const ready = browser !== null && ip !== null && !isLoading && (!isAuthenticated || account !== undefined)
  const shouldAuto = useMemo(
    () => ready && shouldAutoStart(browser, ip, account),
    [ready, browser, ip, account],
  )

  const send = useCallback(
    (event: 'start' | 'done') => {
      fetch('/api/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour, event }),
      }).catch(() => undefined)
      if (isAuthenticated) markAccount({ tour, event }).catch(() => undefined)
    },
    [tour, isAuthenticated, markAccount],
  )

  const onStart = useCallback(() => {
    track('tour_start', { label: tour })
    const next = { runs: (browser?.runs ?? 0) + 1, done: browser?.done ?? false }
    setBrowser(next)
    writeBrowserMemory(tour, next)
    send('start')
  }, [browser, tour, send])

  const onDone = useCallback((finished: boolean) => {
    track(finished ? 'tour_done' : 'tour_skip', { label: tour })
    const next = { runs: browser?.runs ?? 0, done: true }
    setBrowser(next)
    writeBrowserMemory(tour, next)
    send('done')
  }, [browser, tour, send])

  const onStep = useCallback((step: number, total: number) => {
    track('tour_step', { label: `${tour} step ${String(step + 1).padStart(2, '0')} of ${total}` })
  }, [tour])
  const onReplay = useCallback(() => track('tour_replay', { label: tour }), [tour])

  return { ready, shouldAuto, onStart, onDone, onStep, onReplay }
}
