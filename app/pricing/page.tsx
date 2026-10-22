import Link from 'next/link'
import type { Metadata } from 'next'
import { Check, Minus, ArrowRight } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'
import { Display, Lede, Wrap } from '@/components/marketing/primitives'
import {
  PLANS,
  PURCHASABLE_PLANS,
  TERMS,
  type PlanId,
} from '@/convex/model/plans'
import {
  CURRENCIES,
  currencyForCountry,
  formatPrice,
  monthlyPrice,
  parseCurrency,
  termMonthlyIn,
  termPriceIn,
  type CurrencyCode,
} from '@/lib/currency'
import { JobsPricing } from '@/components/marketing/jobs-pricing'
import { PRO_MONTHS, PRO_PRICE } from '@/lib/jobs/pro'

export const metadata: Metadata = {
  title: 'Pricing · DevRel Studio',
  description:
    'DevRel Studio pricing. Three client-reporting plans sold in terms of 1, 3, 6 or 12 months, a free DevRel job board, and Jobs Pro for 12 months in one payment. All prices in US dollars. 14 days free.',
}

// ─── Plan presentation ────────────────────────────────────────────────────────
//
// Names, prices, limits and feature lists all come from convex/model/plans.ts —
// the same definition the server enforces against. The page used to keep its own
// copy, which had drifted: it advertised "All 5 content categories" when there
// are six, and listed PDF export as "coming soon" after it had shipped.
//
// Only presentation lives here.

const HIGHLIGHT: PlanId = 'pro'

const BLURB: Record<PlanId, string> = {
  free: 'See whether it fits how you work.',
  starter: 'One client, tracked properly.',
  pro: 'Several clients, plus a public portfolio.',
  agency: 'Any number of clients, and a team to run them.',
}

/**
 * The comparison table.
 *
 * Rows are derived from the plan limits wherever a limit exists, so the numbers
 * cannot disagree with the ones the server enforces. Only genuinely boolean
 * capabilities are listed by hand — and only ones that actually exist.
 */
const CAPABILITY_ROWS: {
  label: string
  value: (plan: PlanId) => string | boolean
}[] = [
  { label: 'Client workspaces', value: (p) => limitLabel(PLANS[p].maxClients) },
  { label: 'Content entries', value: (p) => limitLabel(PLANS[p].maxEntries) },
  { label: 'Team seats', value: (p) => String(PLANS[p].seats) },
  { label: 'All six content categories', value: () => true },
  { label: 'Live client dashboard', value: () => true },
  { label: 'Access-code protection', value: () => true },
  { label: 'UTM tracking & reshares', value: () => true },
  { label: 'CSV export', value: () => true },
  { label: 'PDF report export', value: (p) => p !== 'free' },
  { label: 'Pipeline board', value: (p) => p !== 'free' },
  { label: 'Public portfolio', value: (p) => p === 'pro' || p === 'agency' },
  { label: 'Automatic npm & GitHub sync', value: (p) => p === 'pro' || p === 'agency' },
  { label: 'Priority support', value: (p) => p === 'pro' || p === 'agency' },
  { label: 'Onboarding call', value: (p) => p === 'agency' },
]

function limitLabel(limit: number | null): string {
  return limit === null ? 'Unlimited' : String(limit)
}

const FAQ = [
  {
    q: 'Is the job board free?',
    a: 'Yes. Browsing, filtering, saving roles, the tracker, CV upload with role matching, two email alerts and three tailored application kits cost nothing.',
  },
  {
    q: 'What does Jobs Pro cost, and what does it add?',
    a: `One payment for ${PRO_MONTHS} months: ${formatPrice(PRO_PRICE.USD, 'USD')}. It adds unlimited tailored CV and cover note kits (up to 60 a month), instant alerts, up to 50 saved alerts, pay benchmarks for your exact role, level and region, and a hiring view. It is separate from the client-reporting plans.`,
  },
  {
    q: 'How do tailored applications avoid sounding machine-written?',
    a: 'Each kit is written only from your CV and the work you have published, then checked against a list of stock phrases and unsupported numbers before you see it. You still read and edit it before you send anything.',
  },
  {
    q: 'How does payment work?',
    a: 'You request a plan, or Jobs Pro, and say how many months you want. We send an invoice with wire details in US dollars. Access opens as soon as the payment clears.',
  },
  {
    q: 'What happens when my access runs out?',
    a: 'Nothing disappears. Your content stays where it is. Your clients keep their dashboards. You just cannot add or edit until you extend.',
  },
  {
    q: 'Can I change plan later?',
    a: 'Yes. Ask for the plan you want and it applies from that point. If you extend early, we add the time to your current window. You never lose days you paid for.',
  },
  {
    q: 'What counts as a client workspace?',
    a: 'Each client gets their own content log and their own dashboard URL. Starter covers one client. Pro covers five. Agency has no limit.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Fourteen days, no card, from the moment you sign up. You get one client workspace and up to 10 entries. That is enough to run it against real content.',
  },
  {
    q: 'What is your refund policy?',
    a: 'Email support@devrel.studio within 14 days of a payment and we refund it. We do not ask why.',
  },
  {
    q: 'Do clients need an account to see their dashboard?',
    a: 'No. The client dashboard is a read-only URL and works in any browser. You choose per client whether it stays open, needs a code, or goes fully public.',
  },
  {
    q: 'Can my team use one account?',
    a: 'The Agency plan includes five seats with admin, editor and viewer roles. People you invite work under your access, so they do not need their own. Starter and Pro are single-user.',
  },
]

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-green" />
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-ink/20" />
  return <span className="text-sm text-foreground">{value}</span>
}

function PlanCard({ id, currency }: { id: PlanId; currency: CurrencyCode }) {
  const plan = PLANS[id]
  const isHighlight = id === HIGHLIGHT
  const isFree = id === 'free'

  return (
    <div
      className={`relative flex flex-col rounded-[2rem] p-7 ${
        isHighlight ? 'bg-ink text-paper' : 'bg-sand text-foreground'
      }`}
    >
      {isHighlight && (
        <span className="absolute right-6 top-6 rounded-md bg-orange px-2.5 py-1 text-xs font-medium text-paper">
          Most popular
        </span>
      )}

      <h2 className="text-2xl font-medium tracking-[-0.03em]">{plan.name}</h2>
      <p className={`mt-1 text-[15px] ${isHighlight ? 'text-paper/65' : 'text-muted-foreground'}`}>{BLURB[id]}</p>

      <div className="mt-8 flex items-baseline gap-1.5">
        <span className="text-5xl font-medium tracking-[-0.04em]">
          {formatPrice(monthlyPrice(id, currency), currency)}
        </span>
        <span className={`text-sm ${isHighlight ? 'text-paper/65' : 'text-muted-foreground'}`}>
          {isFree ? 'for 14 days' : '/month'}
        </span>
      </div>

      <Link
        href={isFree ? '/dashboard' : `/dashboard/billing#plans`}
        className={`mt-7 inline-flex h-12 items-center justify-center gap-2 text-base font-medium transition-colors ${
          isHighlight
            ? 'rounded-[2rem_0.5rem_0.5rem_2rem] bg-orange text-paper hover:bg-paper hover:text-ink'
            : isFree
              ? 'rounded-full border border-ink/25 text-foreground hover:border-ink hover:bg-paper'
              : 'rounded-[2rem_0.5rem_0.5rem_2rem] bg-accent text-accent-foreground hover:bg-ink'
        }`}
      >
        {isFree ? 'Start free' : `Get ${plan.name}`}
        <ArrowRight className="h-4 w-4" />
      </Link>

      <ul className={`mt-7 space-y-3 border-t pt-7 ${isHighlight ? 'border-paper/15' : 'border-ink/10'}`}>
        {plan.features.map((feature) => (
          <li key={feature} className={`flex items-start gap-2.5 text-[15px] ${isHighlight ? 'text-paper/80' : 'text-muted-foreground'}`}>
            <Check className={`mt-1 h-3.5 w-3.5 shrink-0 ${isHighlight ? 'text-orange' : 'text-green'}`} />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ALL_PLANS: PlanId[] = ['free', ...PURCHASABLE_PLANS]

/** Every price is in US dollars. */
export default async function PricingPage() {
  const currency: CurrencyCode = 'USD'

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="px-4 pb-14 pt-12 text-center sm:px-8 sm:pt-20">
        <Display as="h1" size="xl">
          Pricing that scales
          <br />
          with your program
        </Display>
        <Lede className="mt-7">
          Start free for 14 days, no card. After that you buy the months you need, and longer terms cost less. All
          prices are in US dollars. The DevRel job board is free, and Jobs Pro is a separate one-off pass for a year.
        </Lede>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 pb-20 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ALL_PLANS.map((id) => (
            <PlanCard key={id} id={id} currency={currency} />
          ))}
        </div>
      </section>

      {/* Terms */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-8">
        <div className="rounded-[2rem] bg-sand">
          <div className="border-b border-ink/10 px-7 py-7">
            <h2 className="text-2xl font-medium tracking-[-0.03em] text-foreground">Buy months at a time</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pay by invoice and wire transfer, in US dollars. Longer terms cost less.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="px-7 py-4 text-sm font-medium text-muted-foreground">Term</th>
                  {PURCHASABLE_PLANS.map((id) => (
                    <th key={id} className="px-7 py-4 text-center text-sm font-medium text-foreground">
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TERMS.map((term) => (
                  <tr key={term.months} className="border-b border-ink/10 last:border-b-0">
                    <td className="px-7 py-4 text-sm text-foreground">
                      {term.label}
                      {term.discount > 0 && (
                        <span className="ml-2 rounded-md bg-green px-2 py-0.5 text-[11px] text-paper">
                          save {term.discount}%
                        </span>
                      )}
                    </td>
                    {PURCHASABLE_PLANS.map((id) => (
                      <td key={id} className="px-7 py-4 text-center">
                        <span className="text-sm tabular-nums text-foreground">
                          {formatPrice(termPriceIn(id, term, currency), currency)}
                        </span>
                        {term.months > 1 && (
                          <span className="block text-[11px] tabular-nums text-muted-foreground">
                            {formatPrice(termMonthlyIn(id, term, currency), currency)}/mo
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <JobsPricing currency={currency} />

      {/* Comparison */}
      <section className="pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Display>Every plan,<br />side by side</Display>
          </div>

          {/* Wide table on a narrow screen has to scroll in its own container,
              or the whole page scrolls sideways. */}
          <div className="mt-12 overflow-x-auto rounded-[2rem] bg-sand">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="px-5 py-4 text-sm font-medium text-muted-foreground">
                    Feature
                  </th>
                  {ALL_PLANS.map((id) => (
                    <th
                      key={id}
                      className="px-5 py-4 text-center text-sm font-medium text-foreground"
                    >
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITY_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-ink/10 last:border-b-0">
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{row.label}</td>
                    {ALL_PLANS.map((id) => (
                      <td key={id} className="px-5 py-3.5 text-center">
                        <Cell value={row.value(id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-24 sm:px-8">
        <Display className="text-center">Questions, answered</Display>

        <Accordion type="single" collapsible className="mx-auto mt-14 max-w-3xl space-y-3">
          {FAQ.map(({ q, a }, i) => (
            <AccordionItem key={q} value={`item-${i}`} className="rounded-[1.5rem] border-b-0 bg-sand px-7">
              <AccordionTrigger className="py-6 text-left text-lg font-medium tracking-[-0.02em] text-foreground hover:no-underline">
                {q}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-[15px] leading-relaxed text-muted-foreground">
                {a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="mt-10 text-center text-[15px] text-muted-foreground">
          Something missing?{' '}
          <Link href="/contact" className="font-medium text-foreground underline underline-offset-4 decoration-ink/30 hover:text-accent hover:decoration-accent">
            Get in touch
          </Link>
        </p>
      </section>

      <MarketingFooter />
    </div>
  )
}
