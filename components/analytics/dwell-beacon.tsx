'use client'

import { useEffect, useRef } from 'react'

/**
 * Reports how long the visitor stayed, once, when they leave.
 *
 * Renders nothing. The view itself was already counted by proxy.ts before this
 * page rendered — this adds only the duration, which is the number that turns
 * "someone opened your portfolio" into "someone read it".
 *
 * Time is accumulated only while the tab is actually visible. A page left open
 * in a background tab overnight is not six hours of attention, and counting it
 * as such would make the median dwell time on the analytics page meaningless.
 */
export function DwellBeacon({ target }: { target: string }) {
  const activeSince = useRef<number | null>(null)
  const accumulated = useRef(0)
  const sent = useRef(false)

  useEffect(() => {
    activeSince.current = document.visibilityState === 'visible' ? Date.now() : null

    const settle = () => {
      if (activeSince.current !== null) {
        accumulated.current += Date.now() - activeSince.current
        activeSince.current = null
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (activeSince.current === null) activeSince.current = Date.now()
        return
      }
      settle()
      // Hiding the tab is the last reliable moment on mobile, where a browser
      // may kill the page without ever firing pagehide.
      send()
    }

    const send = () => {
      if (sent.current) return
      settle()
      const durationMs = accumulated.current
      // Under two seconds is a bounce or a prefetch, not a read.
      if (durationMs < 2000) return
      sent.current = true

      const payload = JSON.stringify({ target, durationMs })
      const blob = new Blob([payload], { type: 'application/json' })

      // sendBeacon survives the page going away; fetch does not.
      if (navigator.sendBeacon?.('/api/track/duration', blob)) return
      void fetch('/api/track/duration', {
        method: 'POST',
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', send)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', send)
      send()
    }
  }, [target])

  return null
}
