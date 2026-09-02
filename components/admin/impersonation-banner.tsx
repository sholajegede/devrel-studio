'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Eye, Loader2 } from 'lucide-react'

// ── "You are not you" ─────────────────────────────────────────────────────────
//
// The one piece of impersonation that is purely about the person doing it.
//
// Everything else fails closed on its own: writes are refused in
// `getCurrentUser`, the session expires in half an hour, and admin authority
// never comes from the account being viewed. None of that stops an admin from
// reading a number off somebody else's dashboard and acting on it as though it
// were their own — which is the mistake this actually prevents.
//
// So it is fixed to the top of the viewport rather than placed in the layout
// flow, it is not dismissible, and it says whose account this is rather than
// "impersonation active". The name is the part that stops the mistake.

export function ImpersonationBanner() {
  const session = useQuery(api.adminImpersonate.mySession)
  const end = useMutation(api.adminImpersonate.end)
  const router = useRouter()

  const [ending, setEnding] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Ticks only while a session is open, so the ordinary dashboard pays nothing
  // for a banner that is not there.
  useEffect(() => {
    if (!session) return
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [session])

  if (!session) return null

  const minutesLeft = Math.max(0, Math.ceil((session.expiresAt - now) / 60_000))

  async function stop() {
    setEnding(true)
    try {
      await end({})
      toast.success('You are yourself again')
      // The page is full of somebody else's data, fetched under a session that
      // no longer exists. Refreshing is the honest thing to do rather than
      // leaving stale rows on screen that look current.
      router.refresh()
    } catch {
      toast.error('Could not end the session')
    } finally {
      setEnding(false)
    }
  }

  return (
    <>
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-600/40 bg-amber-500/15 px-4 py-2 text-sm backdrop-blur"
      >
        <span className="flex items-center gap-2 text-foreground">
          <Eye className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          Viewing{' '}
          <strong className="font-medium">{session.subjectEmail ?? 'another account'}</strong>{' '}
          read-only
        </span>
        <span className="text-xs text-muted-foreground">
          {minutesLeft === 0
            ? 'ending now'
            : `ends in ${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'}`}
        </span>
        <button
          type="button"
          onClick={stop}
          disabled={ending}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-600/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-amber-500/20 disabled:opacity-60"
        >
          {ending && <Loader2 className="h-3 w-3 animate-spin" />}
          End session
        </button>
      </div>
      {/* Pushes the page down by the banner's height instead of covering the
          first row of it. */}
      <div aria-hidden className="h-10" />
    </>
  )
}
