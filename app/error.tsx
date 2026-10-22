'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RotateCw } from 'lucide-react'
import { Shape } from '@/components/marketing/shapes'

/**
 * Catches render errors anywhere below the root layout, so an unhandled throw
 * shows this instead of Next's default page — which in production is an
 * unstyled "Application error: a client-side exception has occurred".
 *
 * The layout still renders around this, so the sidebar survives.
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
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 w-16">
          <Shape name="cross" color="rust" />
        </div>

        <h1 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-foreground">Something broke on our side</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          This page hit an error it could not recover from. Trying again often works, and the data behind it is
          untouched.
        </p>

        {/* The digest is what correlates this with the server log. Without it a
            bug report is "a page broke" and nothing more. */}
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button onClick={reset} className="gap-2">
            <RotateCw className="h-4 w-4" />
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
