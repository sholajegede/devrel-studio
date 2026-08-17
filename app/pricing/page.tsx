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
import { PLANS, PURCHASABLE_PLANS, type PlanId } from '@/convex/model/plans'

export const metadata: Metadata = {
  title: 'Pricing · DevRel Studio',
  description:
    'One-time pricing for DevRel Studio. Starter $49, Pro $149, Agency $349 — pay once, use forever.',
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
  free: 'Enough to see whether this fits how you work.',
  starter: 'One client, tracked properly.',
  pro: 'Several clients at once, plus a public portfolio.',
  agency: 'Unlimited clients and a team to run them.',
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
    q: 'What exactly is a "one-time fee"?',
    a: 'You pay once and own DevRel Studio forever. No monthly charges, no annual renewals, no seat fees. Updates are included for 12 months from your purchase date.',
  },
  {
    q: 'Can I upgrade to a higher plan later?',
    a: 'Yes — upgrading is a separate one-time purchase at the new plan’s price. Your current plan stays active until the upgrade completes.',
  },
  {
    q: 'What counts as a client workspace?',
    a: 'Each client you manage gets their own content log and a dashboard at their own URL. Starter covers one, Pro covers five, Agency is unlimited.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. The free trial gives you one client workspace and up to 10 content entries, with no card required, so you can see the product working against your real content before paying.',
  },
  {
    q: 'What is your refund policy?',
    a: 'Full refund within 14 days of purchase, no questions asked. Email support@devrel.studio.',
  },
  {
    q: 'Do clients need an account to see their dashboard?',
    a: 'No. The client dashboard is a read-only URL that works in any browser. You can leave it open, protect it with an access code, or share it publicly — your choice, per client.',
  },
  {
    q: 'Can my team use one account?',
    a: 'The Agency plan includes five seats with admin, editor and viewer roles. Starter and Pro are single-user.',
  },
]

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-accent" />
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />
  return <span className="text-sm text-foreground">{value}</span>
}

function PlanCard({ id }: { id: PlanId }) {
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
          ${plan.price}
        </span>
        <span className="text-sm text-muted-foreground">
          {isFree ? 'to try' : 'once'}
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

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 text-center">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Pricing
        </span>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-foreground leading-[1.1]">
          Pay once. Use forever.
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          No subscriptions, no per-seat charges, no renewal you forget to cancel. Pick the
          plan that fits your practice and own it.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ALL_PLANS.map((id) => (
            <PlanCard key={id} id={id} />
          ))}
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
          Something not covered?{' '}
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
