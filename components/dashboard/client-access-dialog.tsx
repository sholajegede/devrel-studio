'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Doc } from '@/convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
} from 'lucide-react'

export function ClientAccessDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Doc<'clients'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [code, setCode] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [copied, setCopied] = useState(false)

  const setClientPublic = useMutation(api.managerAccess.setClientPublic)
  const revokeSessions = useMutation(api.managerAccess.revokeManagerSessions)

  if (!client) return null

  const slug = client.slug ?? ''
  const hasCode = !!client.accessCodeHash
  const isPublic = client.isPublic === true

  const dashboardUrl = (() => {
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'
    const protocol = root.startsWith('localhost') ? 'http' : 'https'
    return `${protocol}://${slug}.${root}`
  })()

  const handleGenerate = async (emailIt = false) => {
    setIsWorking(true)
    try {
      const response = await fetch('/api/manager-access/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client._id,
          slug,
          emailTo: emailIt ? client.email : undefined,
        }),
      })
      const body = await response.json()

      if (!response.ok) {
        toast.error(body.error ?? 'Could not create the code')
        return
      }

      setCode(body.code)

      // The code is shown regardless, so a failed send is a downgrade rather
      // than a failure — say which happened instead of claiming a sent email.
      if (emailIt && !body.emailed) {
        toast.warning('Code created, but the email could not be sent — copy it below')
      } else if (emailIt) {
        toast.success(`Code created and emailed to ${client.email}`)
      } else {
        toast.success(
          hasCode ? 'New code created — the old one stopped working' : 'Access code created',
        )
      }
    } catch {
      toast.error('Could not create the code')
    } finally {
      setIsWorking(false)
    }
  }

  const handleRemove = async () => {
    setIsWorking(true)
    try {
      const response = await fetch(`/api/manager-access/code?clientId=${client._id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        toast.error('Could not remove the code')
        return
      }
      setCode(null)
      toast.success('Access code removed')
    } catch {
      toast.error('Could not remove the code')
    } finally {
      setIsWorking(false)
    }
  }

  const handleRevoke = async () => {
    setIsWorking(true)
    try {
      const { removed } = await revokeSessions({ clientId: client._id })
      toast.success(
        removed > 0
          ? `Signed out ${removed} ${removed === 1 ? 'device' : 'devices'}`
          : 'No active sessions',
      )
    } catch {
      toast.error('Could not sign managers out')
    } finally {
      setIsWorking(false)
    }
  }

  const handleTogglePublic = async (next: boolean) => {
    try {
      await setClientPublic({ clientId: client._id, isPublic: next })
      toast.success(next ? 'Dashboard is public' : 'Dashboard requires a code')
    } catch {
      toast.error('Could not update visibility')
    }
  }

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCode(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Dashboard access
          </DialogTitle>
          <DialogDescription>
            Control who can open {client.company || client.name}&apos;s performance dashboard.
          </DialogDescription>
        </DialogHeader>

        {!slug ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Add a dashboard slug to this client first — the access code is tied to it.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Dashboard URL */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Dashboard link</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs font-mono">
                  {dashboardUrl}
                </code>
                <Button variant="outline" size="sm" onClick={() => copy(dashboardUrl)} className="shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Public toggle */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Anyone with the link</p>
                <p className="text-xs text-muted-foreground">
                  No code required. Use for dashboards you are happy to share openly.
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={handleTogglePublic} />
            </div>

            {/* Access code */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Access code</Label>
                {hasCode && !code && (
                  <span className="text-xs text-muted-foreground">Set — cannot be shown again</span>
                )}
              </div>

              {code ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-center text-lg font-mono tracking-[0.2em] text-foreground">
                      {code}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => copy(code)} className="shrink-0">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Copy this now — it is stored hashed and will not be shown again.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {hasCode
                    ? 'Managers who already have the code keep their access. Create a new one to replace it.'
                    : 'No code yet. Anyone with the link can currently open this dashboard.'}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => handleGenerate(false)} disabled={isWorking} className="gap-1.5">
                  {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {hasCode ? 'Create new code' : 'Create code'}
                </Button>

                {client.email && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate(true)}
                    disabled={isWorking}
                    className="gap-1.5"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Create &amp; email
                  </Button>
                )}

                {hasCode && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleRevoke} disabled={isWorking} className="gap-1.5">
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out managers
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemove}
                      disabled={isWorking}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      Remove code
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
