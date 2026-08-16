import Link from 'next/link'
import { Check, Minus, ArrowRight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'

// ─── Plan data ────────────────────────────────────────────────────────────────

interface Plan {
  name: string
  price: number
  description: string
  highlight: boolean
  badge?: string
  features: string[]
  cta: string
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    price: 49,
    description: 'Perfect for freelance DevRel advocates managing a single client engagement.',
    highlight: false,
    features: [
      '1 client workspace',
      'All 5 content categories',
      'Live client performance dashboard',
      'UTM tracking links',
      'Reshare tracking',
      'Smart filters (month, category, status)',
      'CSV export',
      'Email support',
    ],
    cta: 'Get Starter',
  },
  {
    name: 'Pro',
    price: 149,
    description: 'For DevRel consultants managing multiple client engagements simultaneously.',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Up to 5 client workspaces',
      'Everything in Starter',
      'Advanced analytics overview',
      'Priority email support',
      'Early access to new features',
      'PDF report generation (coming soon)',
    ],
    cta: 'Get Pro',
  },
  {
    name: 'Agency',
    price: 349,
    description: 'For teams and agencies running DevRel programs at scale across many clients.',
    highlight: false,
    features: [
      'Unlimited client workspaces',
      'Everything in Pro',
      'Team member access (up to 5 seats)',
      'White-label client dashboard',
      'Dedicated onboarding call',
      'SLA-backed support',
      'Custom subdomain branding',
    ],
    cta: 'Get Agency',
  },
]

// ─── Feature comparison table ─────────────────────────────────────────────────

const TABLE_ROWS: { label: string; starter: string | boolean; pro: string | boolean; agency: string | boolean }[] = [
  { label: 'Client workspaces',         starter: '1',            pro: 'Up to 5',     agency: 'Unlimited' },
  { label: 'Content categories',         starter: true,           pro: true,           agency: true },
  { label: 'Live client dashboard',      starter: true,           pro: true,           agency: true },
  { label: 'UTM tracking links',         starter: true,           pro: true,           agency: true },
  { label: 'Reshare tracking',           starter: true,           pro: true,           agency: true },
  { label: 'Smart filters',              starter: true,           pro: true,           agency: true },
  { label: 'CSV export',                 starter: true,           pro: true,           agency: true },
  { label: 'Advanced analytics',         starter: false,          pro: true,           agency: true },
  { label: 'Priority support',           starter: false,          pro: true,           agency: true },
  { label: 'Team member seats',          starter: false,          pro: false,          agency: 'Up to 5' },
  { label: 'White-label dashboard',      starter: false,          pro: false,          agency: true },
  { label: 'Custom subdomain',           starter: false,          pro: false,          agency: true },
  { label: 'Onboarding call',            starter: false,          pro: false,          agency: true },
  { label: 'SLA-backed support',         starter: false,          pro: false,          agency: true },
]

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'What exactly is a "one-time fee"?',
    a: 'You pay once and own the software forever. There are no monthly charges, no annual renewals, and no hidden fees. Updates are included for 12 months from purchase.',
  },
  {
    q: 'Can I upgrade to a higher plan later?',
    a: "Yes — upgrading is a separate one-time purchase at the new plan's price. Your current plan stays active until the upgrade completes.",
  },
  {
    q: 'What counts as a "client workspace"?',
    a: 'Each client you manage gets their own workspace with separate content tracking and a unique client dashboard URL. The Starter plan covers one client.',
  },
  {
    q: 'Is there a free trial?',
    a: 'We offer a limited free trial with one workspace and up to 10 content entries so you can see the product before buying.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'Yes — full refund within 14 days of purchase, no questions asked. If DevRel Studio isn\'t working for you, just email us.',
  },
  {
    q: 'Can multiple people use one account?',
    a: 'The Starter and Pro plans are single-user. The Agency plan includes up to 5 team member seats. Need more? Contact us.',
  },
]

// ─── Cell helper ─────────────────────────────────────────────────────────────

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="h-4 w-4 text-accent mx-auto" />
  if (value === false) return <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />
  return <span className="text-sm text-foreground">{value}</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 mb-6">
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-accent">Pay once. Use forever.</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
          Simple, honest pricing
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          No subscriptions. No per-seat charges. No surprises. Choose the plan that fits your
          practice and own it forever.
        </p>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border bg-card flex flex-col ${
                plan.highlight ? 'border-accent ring-1 ring-accent shadow-lg' : 'border-border'
              }`}
            >
              {plan.badge ? (
                <div className="bg-accent text-accent-foreground text-xs font-semibold text-center py-2 rounded-t-2xl">
                  {plan.badge}
                </div>
              ) : (
                <div className="h-8" />
              )}

              <div className="p-6 flex flex-col flex-1">
                <h2 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">one-time</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{plan.description}</p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full gap-2 ${
                    plan.highlight
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                      : ''
                  }`}
                  variant={plan.highlight ? 'default' : 'outline'}
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-2xl font-bold text-foreground text-center mb-10">Compare plans</h2>

        <div className="rounded-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-4 bg-muted/40 border-b border-border">
            <div className="p-4 text-sm font-medium text-muted-foreground">Feature</div>
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`p-4 text-center text-sm font-semibold ${
                  plan.highlight ? 'text-accent' : 'text-foreground'
                }`}
              >
                {plan.name}
              </div>
            ))}
          </div>

          {/* Rows */}
          {TABLE_ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-4 border-b border-border last:border-0 ${
                i % 2 === 0 ? '' : 'bg-muted/20'
              }`}
            >
              <div className="px-4 py-3.5 text-sm text-foreground">{row.label}</div>
              <div className="px-4 py-3.5 text-center"><Cell value={row.starter} /></div>
              <div className="px-4 py-3.5 text-center"><Cell value={row.pro} /></div>
              <div className="px-4 py-3.5 text-center"><Cell value={row.agency} /></div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-card py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-foreground text-center mb-12">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <AccordionItem
                key={q}
                value={`item-${i}`}
                className="rounded-xl border border-border bg-background px-6 data-[state=open]:border-accent/40"
              >
                <AccordionTrigger className="text-sm font-medium text-foreground text-left hover:no-underline py-5">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Still have questions?
        </h2>
        <p className="text-muted-foreground mb-8">
          Reach out and we&apos;ll help you figure out which plan is right for your practice.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="mailto:hello@devrel.studio">
            <Button size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              Contact us
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/">
            <Button size="lg" variant="outline" className="bg-transparent">
              Back to home
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
