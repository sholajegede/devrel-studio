'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { AlertCircle, Clock } from 'lucide-react'

/**
 * How much access is left, and what to do about it.
 *
 * Payments are handled by hand — Stripe needs a US entity — so the call to
 * action is an email, not a checkout button. That is worth stating plainly
 * rather than dressing up: a buyer who expects a card form and finds a mailto
 * link needs to know why before they decide it is broken.
 *
 * Silent while there is plenty of time left. A banner that is always there is a
 * banner nobody reads, and the one moment it matters is the one week before
 * access ends.
 */
export function AccessBanner() {
  const billing = useQuery(api.billing.getMyPlan, {})

  if (!billing) return null
  if (billing.status === 'comped' || billing.status === 'active') {
    // Only speak up when renewal is close enough to act on.
    if ((billing.daysLeft ?? 99) > 10) return null
  }

  const expired = !billing.canWrite

  const message = expired
    ? billing.accessUntil
      ? 'Your access has ended. Your work is safe and your clients’ dashboards are still up — you just cannot add or edit until it is extended.'
      : 'Your free trial has ended. Your work is safe and your clients’ dashboards are still up — you just cannot add or edit until access is extended.'
    : billing.status === 'trial'
      ? `${billing.daysLeft} ${billing.daysLeft === 1 ? 'day' : 'days'} left on your free trial.`
      : `Your access ends in ${billing.daysLeft} ${billing.daysLeft === 1 ? 'day' : 'days'}.`

  return (
    <div
      className={`mb-6 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        expired
          ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10'
          : 'border-border bg-muted/40'
      }`}
    >
      <p className="flex items-start gap-2.5 text-sm">
        {expired ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span
          className={
            expired ? 'text-amber-900 dark:text-amber-200' : 'text-muted-foreground'
          }
        >
          {message}
        </span>
      </p>

      <Link
        href="/dashboard/billing"
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        {expired ? 'Get access' : 'Extend access'}
      </Link>
    </div>
  )
}
