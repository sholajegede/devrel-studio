'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, Lock } from 'lucide-react'

export function AccessGate({
  slug,
  clientName,
  exists,
}: {
  slug: string
  clientName: string | null
  exists: boolean
}) {
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/manager-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, code }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error ?? 'That code is not valid')
        setIsSubmitting(false)
        return
      }

      // Cookie is set — reload so the server layout re-runs and renders the dashboard.
      window.location.reload()
    } catch {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Image
            src="/images/devrel-logo.png"
            alt="DevRel Studio"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="text-base font-semibold text-foreground">
            devrel<span className="text-muted-foreground">.studio</span>
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex justify-center mb-4">
            <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <h1 className="text-lg font-semibold text-foreground text-center">
            {exists && clientName ? `${clientName} performance dashboard` : 'Private dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1.5 mb-6">
            Enter the access code you were given to view this dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-foreground">Access code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="XXXX-XXXX"
                autoComplete="off"
                autoFocus
                className="text-center font-mono tracking-[0.2em] uppercase"
              />
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting || !code.trim()} className="w-full gap-2">
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Checking…</>
              ) : (
                'View dashboard'
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-5">
            Don&apos;t have a code? Ask whoever shared this dashboard with you.
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Your session stays active on this device for 30 days.
        </p>
      </div>
    </div>
  )
}
