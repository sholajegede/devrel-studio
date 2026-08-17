import Link from 'next/link'
import { headers } from 'next/headers'
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
import { CurrencyPicker } from '@/components/marketing/currency-picker'

export const metadata: Metadata = {
  title: 'Pricing · DevRel Studio',
  description:
    'DevRel Studio pricing. Three plans, billed monthly and sold in terms of 1, 3, 6 or 12 months. Prices show in your local currency. 14 days free.',
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
    q: 'How does payment work?',
    a: 'You email us the plan and the number of months. We send transfer details. Access opens when the payment lands. Card payments are not available yet, because Stripe needs a US company and we run this from Nigeria.',
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
  if (value === true) return <Check className="mx-auto h-4 w-4 text-accent" />
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />
  return <span className="text-sm text-foreground">{value}</span>
}

function PlanCard({ id, currency }: { id: PlanId; currency: CurrencyCode }) {
  const plan = PLANS[id]
  const isHighlight = id === HIGHLIGHT
  const isFree = id === 'free'

  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${
        isHighlight ? 'border-accent/40 bg-accent/[0.03]' : 'border-border bg-background'
      }`}
    >
      {isHighlight && (
        <span className="absolute -top-2.5 left-6 rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
          Most popular
        </span>
      )}

      <h2 className="text-[15px] font-medium text-foreground">{plan.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{BLURB[id]}</p>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-[-0.03em] text-foreground">
          {formatPrice(monthlyPrice(id, currency), currency)}
        </span>
        <span className="text-sm text-muted-foreground">
          {isFree ? 'for 14 days' : '/month'}
        </span>
      </div>

      <Link
        href={isFree ? '/dashboard' : `/dashboard/billing#plans`}
        className={`mt-6 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 ${
          isHighlight || !isFree
            ? 'bg-foreground text-background'
            : 'border border-border text-foreground hover:bg-muted'
        }`}
      >
        {isFree ? 'Start free' : `Get ${plan.name}`}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ALL_PLANS: PlanId[] = ['free', ...PURCHASABLE_PLANS]

/**
 * Prices render in the reader's own currency.
 *
 * The country comes from Vercel's geo header, which costs nothing and is on
 * every request in production. Reading it makes this page dynamic, which is the
 * trade: a cached page cannot show a Lagos reader naira. It is a small page and
 * the numbers are static, so the render is cheap.
 *
 * `?currency=` overrides the guess, for anyone behind a VPN or paying from a
 * different country than they are sitting in. A query parameter rather than a
 * client toggle, so the first paint is already right and the choice survives
 * being shared as a link.
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string }>
}) {
  const [{ currency: requested }, headerList] = await Promise.all([searchParams, headers()])
  const currency =
    parseCurrency(requested) ?? currencyForCountry(headerList.get('x-vercel-ip-country'))

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 text-center">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Pricing
        </span>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-foreground leading-[1.1]">
          Pricing
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Start free for 14 days. No card. After that you buy the months you want.
          Longer terms cost less.
        </p>

        <CurrencyPicker current={currency} />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ALL_PLANS.map((id) => (
            <PlanCard key={id} id={id} currency={currency} />
          ))}
        </div>
      </section>

      {/* Terms */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-[15px] font-medium text-foreground">Buy months at a time</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We handle each payment by hand, not through a card form. Longer terms cost less,
              for you and for us.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-sm font-medium text-muted-foreground">Term</th>
                  {PURCHASABLE_PLANS.map((id) => (
                    <th key={id} className="px-6 py-3 text-center text-sm font-medium text-foreground">
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TERMS.map((term) => (
                  <tr key={term.months} className="border-b border-border last:border-b-0">
                    <td className="px-6 py-3.5 text-sm text-foreground">
                      {term.label}
                      {term.discount > 0 && (
                        <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                          save {term.discount}%
                        </span>
                      )}
                    </td>
                    {PURCHASABLE_PLANS.map((id) => (
                      <td key={id} className="px-6 py-3.5 text-center">
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

      {/* Comparison */}
      <section className="border-t border-border bg-card/40 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Compare
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-foreground">
              Every plan, side by side
            </h2>
          </div>

          {/* Wide table on a narrow screen has to scroll in its own container,
              or the whole page scrolls sideways. */}
          <div className="mt-12 overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
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
                  <tr key={row.label} className="border-b border-border last:border-b-0">
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
      <section className="mx-auto max-w-3xl px-6 py-24">
        <div className="text-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            FAQ
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-foreground">
            Questions, answered
          </h2>
        </div>

        <Accordion
          type="single"
          collapsible
          className="mt-12 overflow-hidden rounded-xl border border-border"
        >
          {FAQ.map(({ q, a }, i) => (
            <AccordionItem
              key={q}
              value={`item-${i}`}
              className={`px-6 ${i > 0 ? 'border-t border-border' : ''} border-b-0`}
            >
              <AccordionTrigger className="py-5 text-left text-sm font-medium text-foreground hover:no-underline">
                {q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Something missing?{' '}
          <Link
            href="/contact"
            className="text-foreground underline underline-offset-4 hover:text-accent"
          >
            Get in touch
          </Link>
        </p>
      </section>

      <MarketingFooter />
    </div>
  )
}
