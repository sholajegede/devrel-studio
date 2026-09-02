'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { periodLabel } from '@/lib/report'
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
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'

// ── Writing a report ──────────────────────────────────────────────────────────
//
// Everything in a report used to be generated from the data, which makes a
// competent activity log and a poor report. This is where the parts only a
// person can write get written: the opening paragraph, why the numbers moved,
// an answer to what the client said last period, and anything worth quoting.
//
// One period at a time, because that is the unit a report is sent in. Targets
// sit here too rather than in client settings: a launch month and a quiet month
// are not held to the same goal, and the moment you are looking at the month is
// the moment you know which one it was.

interface Quote {
  text: string
  attribution?: string
  link?: string
}

/** Blank when the field is empty, so saving nothing keeps inheriting the standing goal. */
function numberOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(/,/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null
}

function QuoteEditor({
  quotes,
  onChange,
}: {
  quotes: Quote[]
  onChange: (next: Quote[]) => void
}) {
  const update = (index: number, patch: Partial<Quote>) => {
    onChange(quotes.map((quote, i) => (i === index ? { ...quote, ...patch } : quote)))
  }

  return (
    <div className="space-y-3">
      {quotes.map((quote, index) => (
        <div key={index} className="rounded-lg border border-border p-3">
          <div className="flex items-start gap-2">
            <Textarea
              value={quote.text}
              onChange={(event) => update(index, { text: event.target.value })}
              rows={2}
              maxLength={600}
              placeholder="What someone said about the work"
              className="text-sm"
            />
            <button
              type="button"
              onClick={() => onChange(quotes.filter((_, i) => i !== index))}
              aria-label="Remove quote"
              className="mt-1 rounded p-1 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input
              value={quote.attribution ?? ''}
              onChange={(event) => update(index, { attribution: event.target.value })}
              maxLength={120}
              placeholder="Who said it"
              className="h-9 text-sm"
            />
            <Input
              value={quote.link ?? ''}
              onChange={(event) => update(index, { link: event.target.value })}
              maxLength={500}
              placeholder="Link (optional)"
              className="h-9 text-sm"
            />
          </div>
        </div>
      ))}

      {quotes.length < 6 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...quotes, { text: '' }])}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add a quote
        </Button>
      )}
    </div>
  )
}

export function ReportComposer({
  clientId,
  clientName,
  period,
  open,
  onOpenChange,
}: {
  clientId: Id<'clients'>
  clientName: string
  period: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Skipped while closed so opening the dialog is what fetches — a workspace
  // with twenty clients should not load twenty write-ups to render a list.
  const notes = useQuery(
    api.reports.getNotes,
    open ? { clientId, period } : 'skip',
  )
  const save = useMutation(api.reports.saveNotes)

  const [summary, setSummary] = useState('')
  const [performanceNote, setPerformanceNote] = useState('')
  const [responseToFeedback, setResponseToFeedback] = useState('')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [reachTarget, setReachTarget] = useState('')
  const [publishedTarget, setPublishedTarget] = useState('')
  const [saving, setSaving] = useState(false)

  // Seeded once the server answers. Keyed on the period as well so switching
  // months inside an open dialog does not leave the previous month's text in
  // the boxes — which would be a very easy way to send the wrong write-up.
  useEffect(() => {
    if (!notes) return
    setSummary(notes.summary)
    setPerformanceNote(notes.performanceNote)
    setResponseToFeedback(notes.responseToFeedback)
    setQuotes(notes.quotes)
    setReachTarget(notes.reachTarget === null ? '' : String(notes.reachTarget))
    setPublishedTarget(
      notes.publishedTarget === null ? '' : String(notes.publishedTarget),
    )
  }, [notes, period])

  const submit = async () => {
    setSaving(true)
    try {
      await save({
        clientId,
        period,
        summary,
        performanceNote,
        responseToFeedback,
        quotes: quotes.filter((quote) => quote.text.trim().length > 0),
        reachTarget: numberOrNull(reachTarget),
        publishedTarget: numberOrNull(publishedTarget),
      })
      toast.success(`Write-up saved for ${periodLabel(period)}`)
      onOpenChange(false)
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'data' in error && typeof error.data === 'string'
          ? error.data
          : 'Could not save that write-up'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{periodLabel(period)} — {clientName}</DialogTitle>
          <DialogDescription>
            The parts of the report that are not generated from the data. Everything here is
            optional; anything you leave blank simply does not appear.
          </DialogDescription>
        </DialogHeader>

        {notes === undefined ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes === null ? (
          // The query returns null when the client is not in the caller's
          // workspace. Saying so beats an empty form that refuses to save.
          <p className="py-12 text-center text-sm text-muted-foreground">
            This client is not in your current workspace.
          </p>
        ) : (
          <div className="space-y-6 py-2">
            {/* The paragraph */}
            <div>
              <Label htmlFor="summary" className="text-sm">Summary</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Opens the report, above every number. Blank lines start a new paragraph.
              </p>
              <Textarea
                id="summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={7}
                maxLength={4000}
                placeholder="What this month was about, and what it means for them."
                className="mt-2 text-sm"
              />
            </div>

            {/* Goals */}
            <div>
              <Label className="text-sm">Targets for this month</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {notes.inheritedReachTarget || notes.inheritedPublishedTarget
                  ? 'Leave blank to use the standing goal set on the client.'
                  : 'A number here turns the figure above it from activity into a result.'}
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="reach-target" className="text-xs text-muted-foreground">
                    Reach
                  </Label>
                  <Input
                    id="reach-target"
                    inputMode="numeric"
                    value={reachTarget}
                    onChange={(event) => setReachTarget(event.target.value)}
                    placeholder={
                      notes.inheritedReachTarget
                        ? `${notes.inheritedReachTarget} (standing goal)`
                        : 'e.g. 40000'
                    }
                    className="mt-1.5 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="published-target" className="text-xs text-muted-foreground">
                    Pieces published
                  </Label>
                  <Input
                    id="published-target"
                    inputMode="numeric"
                    value={publishedTarget}
                    onChange={(event) => setPublishedTarget(event.target.value)}
                    placeholder={
                      notes.inheritedPublishedTarget
                        ? `${notes.inheritedPublishedTarget} (standing goal)`
                        : 'e.g. 6'
                    }
                    className="mt-1.5 h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Why the numbers moved */}
            <div>
              <Label htmlFor="performance-note" className="text-sm">What drove this</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Sits under the figures. A reader who sees +40% and no explanation is left
                guessing between a launch, a conference and an algorithm change.
              </p>
              <Textarea
                id="performance-note"
                value={performanceNote}
                onChange={(event) => setPerformanceNote(event.target.value)}
                rows={3}
                maxLength={600}
                placeholder="Reach nearly doubled on the back of the launch post, which HN picked up."
                className="mt-2 text-sm"
              />
            </div>

            {/* Answering last period */}
            <div>
              <Label htmlFor="response" className="text-sm">
                Answering {periodLabel(notes.previousPeriod)}
              </Label>

              {notes.previousFeedback.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {notes.previousFeedback.slice(0, 3).map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
                    >
                      &ldquo;{item.comment}&rdquo;
                      <span className="mt-1 block text-xs">
                        {item.authorName ?? 'Anonymous'}
                        {item.rating ? ` · rated ${item.rating}/5` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  They left no feedback last month. Anything here still appears under
                  &ldquo;Since {periodLabel(notes.previousPeriod)}&rdquo;.
                </p>
              )}

              <Textarea
                id="response"
                value={responseToFeedback}
                onChange={(event) => setResponseToFeedback(event.target.value)}
                rows={3}
                maxLength={1200}
                placeholder="You asked for more video — here is what shipped."
                className="mt-2 text-sm"
              />
            </div>

            {/* Qualitative evidence */}
            <div>
              <Label className="text-sm">In their words</Label>
              <p className="mt-1 mb-2 text-xs text-muted-foreground">
                Quotes, replies and reactions. A maintainer answering a post often matters
                more than the view count on it, and a report of only totals leaves that out.
              </p>
              <QuoteEditor quotes={quotes} onChange={setQuotes} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !notes} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save write-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
