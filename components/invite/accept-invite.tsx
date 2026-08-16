'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2 } from 'lucide-react'

export function AcceptInvite({
  token,
  workspaceName,
}: {
  token: string
  workspaceName: string
}) {
  const router = useRouter()
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    setIsAccepting(true)
    setError(null)

    try {
      const response = await fetch('/api/members/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = await response.json()

      if (!response.ok) {
        setError(body.error ?? 'Could not accept this invitation')
        setIsAccepting(false)
        return
      }

      // Accepting switches the active workspace server-side, so a full
      // navigation is what makes the dashboard load the new one.
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setIsAccepting(false)
    }
  }

  return (
    <>
      <Button onClick={accept} disabled={isAccepting} className="w-full gap-2">
        {isAccepting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Joining…
          </>
        ) : (
          `Join ${workspaceName}`
        )}
      </Button>

      {error && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </>
  )
}
