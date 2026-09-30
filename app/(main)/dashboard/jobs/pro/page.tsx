'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { JobsHeader } from '@/components/jobs/jobs-tabs'
import { CURRENCIES, currencyForTimeZone, formatPrice, type CurrencyCode } from '@/lib/currency'
import { FREE_TAILORINGS, PRO_FEATURES, PRO_MONTHS, PRO_PRICE, PRO_TAILORINGS_PER_MONTH } from '@/lib/jobs/pro'

export default function ProPage() {
  const status = useQuery(api.jobPro.status)
  const requestPro = useMutation(api.jobPro.requestPro)
  const cancel = useMutation(api.jobPro.cancelRequest)
  const [currency, setCurrency] = useState<CurrencyCode>('USD')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCurrency(currencyForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone))
  }, [])

  const price = PRO_PRICE[currency]

  return (
    <main className="px-6 py-8 lg:px-10 max-w-400">
      <RoleNotice />
      <JobsHeader
        title="Jobs Pro"
        description="Everything that helps you get the job, not just find it."
      />

      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6">
        {status?.pro ? (
          <div className="mb-5 rounded-lg bg-accent/10 p-3 text-sm text-foreground">
            {status.comped
              ? 'Jobs Pro is included on your account.'
              : `Jobs Pro is active until ${new Date(status.until ?? 0).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.`}
          </div>
        ) : (
          status && (
            <p className="mb-5 text-sm text-muted-foreground">
              You have used {Math.min(status.used, FREE_TAILORINGS)} of {FREE_TAILORINGS} free CV tailorings.
            </p>
          )
        )}

        <p className="text-3xl font-semibold text-foreground">
          {formatPrice(price, currency)}
          <span className="ml-2 text-base font-normal text-muted-foreground">for {PRO_MONTHS} months, paid once</span>
        </p>

        <ul className="mt-5 space-y-3">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex gap-3 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Up to {PRO_TAILORINGS_PER_MONTH} tailorings a month. Every CV and cover note is written from what you have actually done, and checked for the stock phrases that make applications read as machine-written.
        </p>

        {!status?.pro && (
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="cur" className="text-sm text-muted-foreground">
                Currency
              </label>
              <select
                id="cur"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            {status?.request ? (
              <div className="rounded-lg bg-muted p-3 text-sm">
                Request received for {status.request.amount.toLocaleString('en-US')} {status.request.currency}. We email
                transfer details, and Jobs Pro opens once the payment clears.
                <Button variant="ghost" size="sm" onClick={() => cancel()} className="ml-2">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                disabled={busy}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={async () => {
                  setBusy(true)
                  try {
                    await requestPro({ currency })
                    toast.success('Request sent. Check your email for transfer details.')
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Could not send request')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Get Jobs Pro
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Card payments are not available yet, so this is a bank transfer and the pass is opened by hand once it clears.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
