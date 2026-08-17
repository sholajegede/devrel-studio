'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { ArrowRight, Check, Loader2, Mail } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { PLANS, TERMS, type PlanId } from '@/convex/model/plans'
import {
  formatPrice,
  monthlyPrice,
  priceWithCode,
  termMonthlyIn,
  termPriceIn,
  type CurrencyCode,
} from '@/lib/currency'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// ── Upgrade dialog ────────────────────────────────────────────────────────────
//
// The buy button used to set window.location to a mailto: URL. On a machine
// with no mail client registered — every browser-only Gmail user — that does
// nothing whatsoever: no error, no new window, no hint. The only route to
// paying looked like a dead button.
//
// So the request is made in the app and recorded on the server. The mailto is
// still here, demoted to a link for people who would rather write the message
// themselves, and it no longer carries the whole flow on its own.

export function UpgradeDialog({
  plan,
  currency,
  open,
  onOpenChange,
}: {
  plan: PlanId
  currency: CurrencyCode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const definition = PLANS[plan]
  const createRequest = useMutation(api.accessRequests.create)

  const [months, setMonths] = useState(3)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const term = TERMS.find((t) => t.months === months) ?? TERMS[0]
  const total = termPriceIn(plan, term, currency)
  const perMonth = termMonthlyIn(plan, term, currency)
  const listPerMonth = monthlyPrice(plan, currency)
  const saving = listPerMonth * months - total

  const submit = async () => {
    setSubmitting(true)
    try {
      await createRequest({
        plan,
        months,
        currency,
        amount: total,
        note: note.trim() || undefined,
      })
      setDone(true)
    } catch (error) {
      // The request is the only route to paying, so a failure has to say so
      // rather than leave the button looking inert all over again.
      toast.error(
        error instanceof Error ? error.message : 'Could not send that. Please email us instead.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const close = () => {
    onOpenChange(false)
    // Reset a beat later so the dialog does not visibly change as it closes.
    setTimeout(() => {
      setDone(false)
      setNote('')
    }, 200)
  }

  const mailto = `mailto:support@devrel.studio?subject=${encodeURIComponent(
    `DevRel Studio ${definition.name} access`,
  )}&body=${encodeURIComponent(
    `I'd like ${definition.name} access.\n\nPlan: ${definition.name}\nTerm: ${months} month${months === 1 ? '' : 's'}\nTotal: ${priceWithCode(total, currency)}\n`,
  )}`

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
                <Check className="h-5 w-5 text-accent" />
              </div>
              <DialogTitle className="text-center">Request sent</DialogTitle>
              <DialogDescription className="text-center">
                We have your request for {definition.name}, {months} month
                {months === 1 ? '' : 's'}, at {priceWithCode(total, currency)}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
              We reply within one working day with the transfer details. Your access opens
              once the payment clears. Your trial runs as normal until then.
            </div>

            <DialogFooter>
              <Button onClick={close} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Get {definition.name}</DialogTitle>
              <DialogDescription>
                Pick how many months you want. We send transfer details and open your
                access once the payment clears.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-foreground">Term</p>
                <div className="grid grid-cols-4 gap-2">
                  {TERMS.map((option) => {
                    const active = option.months === months
                    return (
                      <button
                        key={option.months}
                        type="button"
                        onClick={() => setMonths(option.months)}
                        aria-pressed={active}
                        className={`rounded-lg border px-2 py-2.5 text-center transition-colors ${
                          active
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="block text-sm font-medium">{option.months}</span>
                        <span className="block text-[10px] opacity-70">
                          {option.months === 1 ? 'month' : 'months'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatPrice(total, currency)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
                  <span>
                    {formatPrice(perMonth, currency)} a month
                  </span>
                  {saving > 0 && (
                    <span className="text-accent">
                      Saves {formatPrice(saving, currency)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-foreground">
                  Anything we should know? <span className="text-muted-foreground">Optional</span>
                </p>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Invoice details, a company name, a question about the plan."
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={submit} disabled={submitting} className="w-full gap-1.5">
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    Send request
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
              <a
                href={mailto}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                <Mail className="h-3 w-3" />
                Or write the email yourself
              </a>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
