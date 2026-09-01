'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { ConvexError } from 'convex/values'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2 } from 'lucide-react'

/** What both dialogs need to know about the purchase in front of them. */
export interface PendingRequest {
  id: Id<'accessRequests'>
  email: string
  name: string | null
  plan: string
  planName: string
  months: number
  currency: string
  amount: number
  account: { until: number | null; state: string } | null
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
 * Approve a purchase.
 *
 * The term and plan are editable, pre-filled with what was asked for, because
 * what someone requested and what they actually paid are not always the same.
 *
 * The dialog shows the resulting expiry date before anything is written. That
 * date is the whole decision — approving a renewal a month early should add to
 * the time left rather than restart it, and the only way to be believed about
 * that is to show the date it lands on.
 */
export function ApproveDialog({
  request,
  open,
  onOpenChange,
}: {
  request: PendingRequest
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const approve = useMutation(api.admin.approveRequest)

  const [months, setMonths] = useState(String(request.months))
  const [plan, setPlan] = useState<GrantablePlanId>(
    PURCHASABLE_PLANS.includes(request.plan as GrantablePlanId)
      ? (request.plan as GrantablePlanId)
      : 'pro',
  )
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const parsed = Number(months)
  const valid =
    months !== '' &&
    Number.isInteger(parsed) &&
    parsed > 0 &&
    parsed <= MAX_ACCESS_MONTHS

  const preview = valid
    ? extendAccessWindow(request.account?.until ?? undefined, parsed)
    : null

  const changed = parsed !== request.months || plan !== request.plan

  async function submit() {
    if (!valid) return
    setSaving(true)
    try {
      const result = await approve({
        requestId: request.id,
        months: parsed,
        plan,
        note: note.trim() || undefined,
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
          <DialogTitle>Approve this purchase</DialogTitle>
          <DialogDescription>
            Opens access for {request.name ?? request.email} and closes the request,
            in one step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="approve-plan">Plan</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as GrantablePlanId)}>
                <SelectTrigger id="approve-plan">
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
              <Label htmlFor="approve-months">Months</Label>
              <Input
                id="approve-months"
                type="number"
                min={1}
                max={MAX_ACCESS_MONTHS}
                value={months}
                onChange={(event) => setMonths(event.target.value)}
              />
            </div>
          </div>

          {changed && (
            <p className="text-xs text-muted-foreground">
              They asked for {request.planName}, {request.months}{' '}
              {request.months === 1 ? 'month' : 'months'}. The change will be recorded.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="approve-note">Note</Label>
            <Textarea
              id="approve-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={`${request.currency} ${request.amount.toLocaleString()} received`}
            />
            <p className="text-xs text-muted-foreground">
              Kept on the account and in the audit trail. Left blank, it records the
              amount quoted and who approved it.
            </p>
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve and grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Turn a request down.
 *
 * Nothing is emailed. A decline usually means the money never arrived or the
 * plan was wrong, and an automated "no" to someone who may have already sent a
 * transfer is worse than a reply written by a person — so the reason recorded
 * here is for the audit trail and for whoever writes that reply.
 */
export function DeclineDialog({
  request,
  open,
  onOpenChange,
}: {
  request: PendingRequest
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const decline = useMutation(api.admin.declineRequest)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      await decline({ requestId: request.id, reason: reason.trim() || undefined })
      toast.success(`Request from ${request.email} declined`)
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
          <DialogTitle>Decline this request</DialogTitle>
          <DialogDescription>
            Closes the request from {request.name ?? request.email}. No access is
            granted and nothing is emailed — write to them yourself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="decline-reason">Reason</Label>
          <Textarea
            id="decline-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="No transfer received after two weeks"
          />
          <p className="text-xs text-muted-foreground">
            Recorded in the audit trail. Only admins see it.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
