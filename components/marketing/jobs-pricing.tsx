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
    <section id="jobs" className="mx-auto max-w-5xl px-4 pb-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[clamp(2.25rem,5.4vw,4rem)] font-medium leading-[1.03] tracking-[-0.03em] text-foreground">
          Find the role.
          <br />
          Then get it.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          The board is free. Jobs Pro is one payment for a year and covers the parts that help you win the job. It is
          separate from the client-reporting plans above.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col rounded-[2rem] bg-sand p-7">
          <h3 className="text-2xl font-medium tracking-[-0.03em] text-foreground">Job board</h3>
          <div className="mt-8 flex items-baseline gap-1.5">
            <span className="text-5xl font-medium tracking-[-0.04em] text-foreground">Free</span>
            <span className="text-sm text-muted-foreground">always</span>
          </div>
          <Link
            href="/jobs"
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink/25 text-base font-medium text-foreground transition-colors hover:border-ink hover:bg-paper"
          >
            Browse jobs
            <ArrowRight className="h-4 w-4" />
          </Link>
          <ul className="mt-7 space-y-3 border-t border-ink/10 pt-7">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[15px] text-muted-foreground">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-green" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-col rounded-[2rem] bg-ink p-7 text-paper">
          <span className="absolute right-6 top-6 rounded-md bg-orange px-2.5 py-1 text-xs font-medium text-paper">
            One payment
          </span>
          <h3 className="text-2xl font-medium tracking-[-0.03em]">Jobs Pro</h3>
          <div className="mt-8 flex items-baseline gap-1.5">
            <span className="text-5xl font-medium tracking-[-0.04em]">{formatPrice(PRO_PRICE[currency], currency)}</span>
            <span className="text-sm text-paper/65">once, for {PRO_MONTHS} months</span>
          </div>
          <Link
            href="/dashboard/jobs/pro"
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-[2rem_0.5rem_0.5rem_2rem] bg-orange text-base font-medium text-paper transition-colors hover:bg-paper hover:text-ink"
          >
            Get Jobs Pro
            <ArrowRight className="h-4 w-4" />
          </Link>
          <ul className="mt-7 space-y-3 border-t border-paper/15 pt-7">
            <li className="flex items-start gap-2.5 text-[15px] text-paper/80">
              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-orange" />
              Everything in the free board
            </li>
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[15px] text-paper/80">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-orange" />
                {feature}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-paper/55">
            Up to {PRO_TAILORINGS_PER_MONTH} tailorings a month. Invoiced in US dollars, like the plans above. Refunded
            within 14 days.
          </p>
        </div>
      </div>
    </section>
  )
}
