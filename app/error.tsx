'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCw } from 'lucide-react'

/**
 * Catches render errors anywhere below the root layout, so an unhandled throw
 * shows this instead of Next's default page — which in production is an
 * unstyled "Application error: a client-side exception has occurred".
 *
 * The layout still renders around this, so the sidebar and theme survive.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] unhandled render error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>

        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page hit an error it could not recover from. Trying again often works —
          the data behind it is unaffected.
        </p>

        {/* The digest is what correlates this with the server log. Without it a
            bug report is "a page broke" and nothing more. */}
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button onClick={reset} className="gap-2">
            <RotateCw className="h-3.5 w-3.5" />
            Try again
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
