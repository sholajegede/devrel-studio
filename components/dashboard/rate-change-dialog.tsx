'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { billingSegments, formatMoney, type RetainerSource } from '@/lib/retainer'
import { Loader2, TrendingUp } from 'lucide-react'

/**
 * Records a raise or a cut against a date.
 *
 * Separate from the client edit form on purpose. Typing a new number into that
 * form means "the rate on file is wrong"; a rate *change* is a different event —
 * it has a date, everything before it stays billed at the old figure, and the
 * two must not be conflated or the earnings total silently rewrites history.
 */
export function RateChangeDialog({
  client,
  open,
  onOpenChange,
}: {
  client: RetainerSource & { _id: Id<'clients'>; company: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const changeRate = useMutation(api.clients.changeRetainerRate)

  const [amount, setAmount] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const parsed = Number(amount)
  const valid = amount !== '' && Number.isFinite(parsed) && parsed >= 0

  // Show what the change will do before it is committed. The whole point of
  // dating a rate is that it does not touch the past, and the easiest way to be
  // believed about that is to show the arithmetic.
  const preview = valid
    ? billingSegments({
        ...client,
        monthlyRetainer: parsed,
        rateHistory: [
          ...(client.rateHistory?.length
            ? client.rateHistory
            : client.monthlyRetainer && client.startDate
              ? [{ amount: client.monthlyRetainer, effectiveFrom: client.startDate }]
              : []),
          { amount: parsed, effectiveFrom },
        ],
      })
    : []

  const previewTotal = preview.reduce((sum, segment) => sum + segment.subtotal, 0)

  async function submit() {
    if (!valid) return
    setSaving(true)
    try {
      await changeRate({
        clientId: client._id,
        amount: parsed,
        effectiveFrom,
        note: note.trim() || undefined,
      })
      toast.success(
        `${client.company} is now ${formatMoney(parsed, client.currency)}/mo from ${effectiveFrom}`,
      )
      onOpenChange(false)
      setAmount('')
      setNote('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the new rate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Change retainer
          </DialogTitle>
          <DialogDescription>
            {client.monthlyRetainer
              ? `${client.company} is currently on ${formatMoney(client.monthlyRetainer, client.currency)} a month. Months already billed keep the old rate.`
              : `Set the monthly retainer for ${client.company}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rate-amount">New monthly rate</Label>
              <Input
                id="rate-amount"
                inputMode="decimal"
                placeholder="3000"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate-from">Effective from</Label>
              <Input
                id="rate-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rate-note">Reason (optional)</Label>
            <Input
              id="rate-note"
              placeholder="Scope increase"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {preview.length > 1 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium">After this change</p>
              <ul className="mt-2 space-y-1">
                {preview.map((segment, index) => (
                  <li
                    key={index}
                    className="flex justify-between text-xs text-muted-foreground tabular-nums"
                  >
                    <span>
                      {segment.months} × {formatMoney(segment.amount, client.currency)}
                    </span>
                    <span>{formatMoney(segment.subtotal, client.currency)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t pt-2 text-xs font-medium tabular-nums">
                <span>Earned to date</span>
                <span>{formatMoney(previewTotal, client.currency)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save new rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
