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
import {
  formatMoney,
  monthsPaused,
  openPause,
  totalBilled,
  type RetainerSource,
} from '@/lib/retainer'
import { Loader2, PauseCircle, PlayCircle } from 'lucide-react'

/**
 * Puts an engagement on hold, or brings it back, against a date.
 *
 * Pausing used to be a status with no date attached, which meant the earnings
 * total had to assume the client kept paying throughout and carry a warning
 * saying so. Recording when the hold started is what lets the months actually
 * be dropped from the total.
 */
export function PauseDialog({
  client,
  open,
  onOpenChange,
}: {
  client: RetainerSource & { _id: Id<'clients'>; company: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setPauseState = useMutation(api.clients.setPauseState)

  const active = openPause(client)
  const resuming = Boolean(active)

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // What the hold has cost so far, shown when resuming — the number that makes
  // the pause feel real rather than a flag somewhere.
  const skipped = monthsPaused(client)
  const currentTotal = totalBilled(client)

  async function submit() {
    setSaving(true)
    try {
      await setPauseState({
        clientId: client._id,
        paused: !resuming,
        date,
        note: note.trim() || undefined,
      })
      toast.success(
        resuming
          ? `${client.company} resumed from ${date}`
          : `${client.company} paused from ${date} — billing stops`,
      )
      onOpenChange(false)
      setNote('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the pause')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {resuming ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <PauseCircle className="h-4 w-4" />
            )}
            {resuming ? 'Resume engagement' : 'Pause engagement'}
          </DialogTitle>
          <DialogDescription>
            {resuming
              ? `${client.company} has been on hold since ${active?.from}. Billing restarts from the date you set.`
              : `Billing for ${client.company} stops from this date. Months already invoiced are not affected.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pause-date">
              {resuming ? 'Work resumed on' : 'On hold from'}
            </Label>
            <Input
              id="pause-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pause-note">Reason (optional)</Label>
            <Input
              id="pause-note"
              placeholder={resuming ? 'Budget approved' : 'Budget freeze'}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {resuming && skipped > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {skipped} month{skipped === 1 ? '' : 's'}
                </span>{' '}
                not billed during this hold.
              </p>
              {currentTotal !== null && (
                <p className="mt-1">
                  Earned so far: {formatMoney(currentTotal, client.currency)}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {resuming ? 'Resume billing' : 'Pause billing'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
