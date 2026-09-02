'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConvexError } from 'convex/values'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MAX_ACCESS_MONTHS, extendAccessWindow } from '@/convex/model/access'
import { PLANS, PURCHASABLE_PLANS, type GrantablePlanId } from '@/convex/model/plans'
import { AlertTriangle, Eye, Loader2 } from 'lucide-react'

// ── Acting on one account ─────────────────────────────────────────────────────
//
// Grant, revoke and comp. The three things that were previously done in a
// Convex dashboard session against the raw table, with no record of who did
// them or why.
//
// Each dialog states its consequence in a sentence before the button that
// causes it, and each shows the resulting date or state where there is one. An
// operator acting on somebody's paid access should never have to hold the
// arithmetic in their head to know what they are about to do.

/** What every dialog here needs to know about the account in front of it. */
export interface AdminAccount {
  id: Id<'users'>
  email: string
  name: string | null
  state: string
  planName: string
  /**
   * The raw column, not what `accessOf` reports.
   *
   * A comped account reads as `until: null` however much paid time it has left,
   * and both the grant preview and the comp warning below are about the window
   * *underneath* the comp — the one the server extends, and the one somebody
   * falls back to when the comp comes off.
   */
  accessUntil: number | null
  comped: boolean
}

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

/** Convex throws ConvexError with a message we wrote; anything else is a bug. */
function reasonFor(error: unknown): string {
  if (error instanceof ConvexError) return String(error.data)
  return 'Something went wrong. Nothing was changed.'
}

/**
 * Open an access window by hand.
 *
 * The same act as approving a request, for a purchase that never produced one.
 * The resulting date is shown before anything is written, because renewing
 * early must add to the time left rather than restart it and the only way to be
 * believed about that is to show where it lands.
 */
export function GrantDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AdminAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const grant = useMutation(api.adminUsers.grantAccess)

  const [plan, setPlan] = useState<GrantablePlanId>('pro')
  const [months, setMonths] = useState('3')
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)

  const parsed = Number(months)
  const valid =
    months !== '' && Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_ACCESS_MONTHS

  const preview = valid ? extendAccessWindow(account.accessUntil ?? undefined, parsed) : null

  async function submit() {
    if (!valid) return
    setSaving(true)
    try {
      const result = await grant({
        userId: account.id,
        plan,
        months: parsed,
        reason: reason.trim() || undefined,
        notify,
      })
      toast.success(
        `${result.email} has ${PLANS[plan].name} until ${formatDate(result.until)}`,
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(reasonFor(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant access</DialogTitle>
          <DialogDescription>
            Opens a paid window for {account.name ?? account.email} without a request
            behind it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="grant-plan">Plan</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as GrantablePlanId)}>
                <SelectTrigger id="grant-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASABLE_PLANS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PLANS[id].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-months">Months</Label>
              <Input
                id="grant-months"
                type="number"
                min={1}
                max={MAX_ACCESS_MONTHS}
                value={months}
                onChange={(event) => setMonths(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-reason">Reason</Label>
            <Textarea
              id="grant-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="USD 150 received by transfer, no request raised"
            />
            <p className="text-xs text-muted-foreground">
              Kept on the account and in the audit trail.
            </p>
          </div>

          {/* Opt-out rather than automatic: a hand grant is as often a
              correction to a window they already have, and "you're in" to
              somebody who never noticed they were out invents a worry. */}
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={notify}
              onCheckedChange={(value) => setNotify(value === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              Email them that access is open, with the expiry date.
            </span>
          </label>

          {preview && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
              {preview.extended ? (
                <>
                  Access runs to {formatDate(preview.from)} today. This extends it to{' '}
                  <strong className="font-medium text-foreground">
                    {formatDate(preview.until)}
                  </strong>
                  .
                </>
              ) : (
                <>
                  Access opens today and runs to{' '}
                  <strong className="font-medium text-foreground">
                    {formatDate(preview.until)}
                  </strong>
                  .
                </>
              )}
            </div>
          )}

          {account.comped && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This account is comped, so it already has everything. The window is
              recorded, but nothing about what they can do changes.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Close an access window.
 *
 * Owner-only server-side; this dialog is only rendered for one. The reason is
 * required here as well as in the mutation, so the requirement is discovered
 * while typing rather than as an error after pressing the button.
 */
export function RevokeDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AdminAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const revoke = useMutation(api.adminUsers.revokeAccess)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const valid = reason.trim().length > 0

  async function submit() {
    if (!valid) return
    setSaving(true)
    try {
      const result = await revoke({ userId: account.id, reason: reason.trim() })
      toast.success(
        result.stillComped
          ? `${result.email} revoked — but the account is comped, so it keeps everything`
          : `${result.email} no longer has access`,
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(reasonFor(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revoke access</DialogTitle>
          <DialogDescription>
            Closes the window for {account.name ?? account.email}. Nothing is deleted —
            their work and their clients&apos; dashboards stay up, and they can read but
            not write.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="revoke-reason">Reason</Label>
          <Textarea
            id="revoke-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Refunded in full on 4 September"
          />
          <p className="text-xs text-muted-foreground">
            Required. This is the row read back if the charge is ever disputed.
          </p>
        </div>

        {account.comped && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This account is comped, which outranks the window. Revoking records the
            decision but changes nothing they can do — remove the comp as well.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Comp an account, or stop comping it.
 *
 * One dialog for both directions, because they are the same decision read
 * forwards and backwards, and because the warning that matters is on the way
 * out: an account that has only ever been comped has no window underneath, so
 * removing it locks them out immediately.
 */
export function CompDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AdminAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setComped = useMutation(api.adminUsers.setComped)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const comping = !account.comped
  // Only a paid window still running survives the comp coming off. Read from
  // the raw column for the reason given on the field: the effective date is
  // null for every comped account, which would make this warn on all of them.
  const hasWindowUnderneath = Boolean(account.accessUntil && account.accessUntil > Date.now())

  async function submit() {
    setSaving(true)
    try {
      const result = await setComped({
        userId: account.id,
        comped: comping,
        reason: reason.trim() || undefined,
      })
      toast.success(
        result.comped
          ? `${result.email} is comped`
          : result.leavesWithoutAccess
            ? `${result.email} is no longer comped, and now has no access`
            : `${result.email} is no longer comped`,
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(reasonFor(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{comping ? 'Comp this account' : 'Remove the comp'}</DialogTitle>
          <DialogDescription>
            {comping ? (
              <>
                Gives {account.name ?? account.email} the top plan indefinitely, with no
                purchase and no expiry.
              </>
            ) : (
              <>
                Returns {account.name ?? account.email} to whatever access they have
                bought.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="comp-reason">Reason</Label>
          <Textarea
            id="comp-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={comping ? 'Advisor' : 'Advisory period ended'}
          />
          <p className="text-xs text-muted-foreground">
            Recorded in the audit trail. Only admins see it.
          </p>
        </div>

        {!comping && !hasWindowUnderneath && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            There is no paid window underneath this comp. Removing it locks the account
            out today — grant a term first if that is not what you mean.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={comping ? 'default' : 'destructive'}
            onClick={submit}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {comping ? 'Comp' : 'Remove comp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Open somebody's account read-only.
 *
 * The dialog spells out what it does and does not do, because "impersonate" is a
 * word that means anything from a debug view to a full account takeover, and an
 * admin should know which one they are about to get before they press it.
 *
 * A reason is required. This is the only action in the console that changes no
 * data at all, which is exactly why the record of it has to be the strongest:
 * nothing else in the system will ever show that it happened.
 */
export function ImpersonateDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AdminAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const start = useMutation(api.adminImpersonate.start)
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const valid = reason.trim().length > 0

  async function submit() {
    if (!valid) return
    setSaving(true)
    try {
      const result = await start({ userId: account.id, reason: reason.trim() })
      toast.success(`Viewing ${result.email} — read-only, for 30 minutes`)
      onOpenChange(false)
      // Straight to the dashboard, because that is the thing being looked at.
      // Staying on the admin page would leave somebody wearing an account with
      // nothing on screen to show it.
      router.push('/dashboard')
    } catch (error) {
      toast.error(reasonFor(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>View as {account.name ?? account.email}</DialogTitle>
          <DialogDescription>
            Opens the dashboard as they see it, for thirty minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              You will see their clients, entries and reports.
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Nothing can be changed — every write is refused while the session is
              open, including your own.
            </li>
          </ul>

          <div className="space-y-1.5">
            <Label htmlFor="impersonate-reason">Reason</Label>
            <Textarea
              id="impersonate-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Says their September report is empty — checking what they see"
            />
            <p className="text-xs text-muted-foreground">
              Required, and kept permanently. This action leaves no other trace.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            View as them
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
