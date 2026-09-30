import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { FREE_TAILORINGS, PRO_FEATURES, PRO_MONTHS, PRO_PRICE, PRO_TAILORINGS_PER_MONTH } from '@/lib/jobs/pro'

const FREE_FEATURES = [
  'Every DevRel, advocacy, developer success, community and docs role, refreshed three times a day',
  'Filters for level, pay, region, contract work, and whether a role is open in your country',
  'A saved-jobs tracker with stages, notes and follow-up reminders',
  'CV upload with role matching, and 2 daily or weekly email alerts',
  `${FREE_TAILORINGS} free tailored CV and cover note kits`,
]

/** The job board's pricing. Shown on the pricing page in the reader's currency. */
export function JobsPricing({ currency }: { currency: CurrencyCode }) {
  return (
    <section id="jobs" className="mx-auto max-w-5xl px-6 pb-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          The DevRel job board
        </span>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-foreground">
          Find the role. Then get it.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          The board is free. Jobs Pro is one payment for a year and covers the parts that help you win the job.
          It is separate from the client-reporting plans above.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-border bg-background p-6">
          <h3 className="text-[15px] font-medium text-foreground">Job board</h3>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold tracking-[-0.03em] text-foreground">Free</span>
            <span className="text-sm text-muted-foreground">always</span>
          </div>
          <Link
            href="/jobs"
            className="mt-6 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
          >
            Browse jobs
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-col rounded-xl border border-accent/40 bg-accent/[0.03] p-6">
          <span className="absolute -top-2.5 left-6 rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
            Jobs Pro
          </span>
          <h3 className="text-[15px] font-medium text-foreground">Jobs Pro</h3>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold tracking-[-0.03em] text-foreground">
              {formatPrice(PRO_PRICE[currency], currency)}
            </span>
            <span className="text-sm text-muted-foreground">once, for {PRO_MONTHS} months</span>
          </div>
          <Link
            href="/dashboard/jobs/pro"
            className="mt-6 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-foreground text-sm font-medium text-background hover:opacity-90"
          >
            Get Jobs Pro
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
            <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              Everything in the free board
            </li>
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                {feature}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Up to {PRO_TAILORINGS_PER_MONTH} tailorings a month. Paid by bank transfer, like the plans above.
            Refunded within 14 days.
          </p>
        </div>
      </div>
    </section>
  )
}
