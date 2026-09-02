'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { ConvexError } from 'convex/values'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react'

// ── Lockouts ──────────────────────────────────────────────────────────────────
//
// A manager who mistypes an access code enough times waits fifteen minutes, and
// cannot clear it themselves. Neither can the DevRel from their own dashboard.
// The override used to be a terminal command that required knowing the slug —
// and the support email says "the link doesn't work", not "please clear the
// attempts row for acme".
//
// The page distinguishes the two things the old command bundled. A caller row is
// one person getting it wrong, almost always the manager. The whole-dashboard
// counter is the ceiling across every caller, which is what catches somebody
// spread across many addresses — lifting that is a different decision and gets a
// different checkbox.

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.adminWorkspaces.listLockouts>>>[number]

export default function AdminAbusePage() {
  const [includeExpired, setIncludeExpired] = useState(false)
  const rows = useQuery(api.adminWorkspaces.listLockouts, { includeExpired })
  const [unlocking, setUnlocking] = useState<Row | null>(null)

  const loading = rows === undefined
  const locked = rows?.filter((row) => row.lockedCallers > 0 || row.slugWide?.locked) ?? []

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Lockouts</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : locked.length === 0
                ? 'Nobody is locked out'
                : `${locked.length} ${locked.length === 1 ? 'dashboard' : 'dashboards'} with someone shut out`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={includeExpired}
            onCheckedChange={(value) => setIncludeExpired(value === true)}
          />
          Include expired attempts
        </label>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="gap-0 p-4">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="gap-0 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {includeExpired
              ? 'No failed access-code attempts have been recorded.'
              : 'Nobody is locked out. Expired attempts are hidden — tick the box to see them.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <LockoutCard key={row.slug} row={row} onUnlock={() => setUnlocking(row)} />
          ))}
        </div>
      )}

      {unlocking && (
        <UnlockDialog
          key={unlocking.slug}
          row={unlocking}
          open
          onOpenChange={(open) => !open && setUnlocking(null)}
        />
      )}
    </>
  )
}

function LockoutCard({ row, onUnlock }: { row: Row; onUnlock: () => void }) {
  const anyLocked = row.lockedCallers > 0 || row.slugWide?.locked

  return (
    <Card className="gap-0 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {anyLocked && (
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            )}
            <span className="font-medium text-foreground">{row.slug}.devrel.studio</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {row.client ? (
              row.client.workspaceId ? (
                <Link
                  href={`/admin/workspaces/${row.client.workspaceId}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {row.client.company}
                </Link>
              ) : (
                row.client.company
              )
            ) : (
              // The counter outlives the client: attempts are keyed by slug, and
              // deleting a client does not clear them. Worth saying rather than
              // showing a blank, because it explains a lockout on an address
              // that no longer resolves to anything.
              'No client has this slug any more'
            )}
          </p>

          <ul className="mt-3 space-y-1.5 text-sm">
            {row.callers.map((caller) => (
              <li key={caller.id} className="flex flex-wrap items-baseline gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {caller.bucket}…
                </code>
                <span className={caller.locked ? 'text-foreground' : 'text-muted-foreground'}>
                  {caller.failures} {caller.failures === 1 ? 'failure' : 'failures'}
                  {caller.locked && caller.lockedUntil
                    ? ` · locked for ${minutesLeft(caller.lockedUntil)}`
                    : ' · not locked'}
                </span>
                <span className="text-xs text-muted-foreground">
                  last {relative(caller.lastFailureAt)}
                </span>
              </li>
            ))}
          </ul>

          {row.slugWide && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Whole-dashboard counter: {row.slugWide.failures} failures across every
              caller
              {row.slugWide.locked && row.slugWide.lockedUntil
                ? `, holding everyone off for ${minutesLeft(row.slugWide.lockedUntil)}`
                : ', not currently holding anyone off'}
              . This is the one that catches an attacker spread across addresses.
            </p>
          )}
        </div>

        <Button size="sm" variant="outline" className="shrink-0" onClick={onUnlock}>
          Lift
        </Button>
      </div>
    </Card>
  )
}

function UnlockDialog({
  row,
  open,
  onOpenChange,
}: {
  row: Row
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const clear = useMutation(api.adminWorkspaces.clearLockout)
  const [includeSlugWide, setIncludeSlugWide] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const result = await clear({
        slug: row.slug,
        includeSlugWide,
        reason: reason.trim() || undefined,
      })
      toast.success(
        `Cleared ${result.cleared} ${result.cleared === 1 ? 'row' : 'rows'} on ${result.slug}`,
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : 'Something went wrong. Nothing was changed.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lift the lockout on {row.slug}</DialogTitle>
          <DialogDescription>
            Clears the wait for the callers who got the code wrong. It grants nothing —
            the code still has to be right on the next attempt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {row.slugWide && (
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={includeSlugWide}
                onCheckedChange={(value) => setIncludeSlugWide(value === true)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                Also clear the whole-dashboard counter.{' '}
                <span className="text-foreground">
                  This lifts the ceiling for every caller
                </span>{' '}
                — including whoever is guessing from a different address each time.
              </span>
            </label>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="unlock-reason">Reason</Label>
            <Textarea
              id="unlock-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Manager wrote in — mistyped the code four times"
            />
            <p className="text-xs text-muted-foreground">
              Recorded in the audit trail. Only admins see it.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function minutesLeft(until: number): string {
  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000))
  return minutes === 1 ? 'another minute' : `another ${minutes} minutes`
}

function relative(ms: number): string {
  const minutes = Math.floor((Date.now() - ms) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
