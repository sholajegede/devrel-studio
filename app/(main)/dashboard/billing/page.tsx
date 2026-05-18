'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Zap, ArrowRight, Crown, Building2, ExternalLink, Receipt, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { AdminTour, AdminTourTriggerButton, TourVariant } from '@/components/admin-onboarding-tour'

const PLANS = [
  {
    name: 'Starter',
    price: 49,
    icon: Zap,
    description: 'Perfect for freelancers managing one client.',
    features: ['1 client workspace', 'All 5 content categories', 'Live client dashboard', 'UTM tracking & reshares', 'CSV export', 'Email support'],
    highlight: false,
    cta: 'Get Starter',
  },
  {
    name: 'Pro',
    price: 149,
    icon: Crown,
    description: 'Built for consultants with multiple clients.',
    features: ['Up to 5 client workspaces', 'Everything in Starter', 'Advanced analytics', 'Priority support', 'Early access to features'],
    highlight: true,
    cta: 'Get Pro',
  },
  {
    name: 'Agency',
    price: 349,
    icon: Building2,
    description: 'Unlimited clients for growing agencies.',
    features: ['Unlimited client workspaces', 'Everything in Pro', 'Up to 5 team seats', 'White-label dashboard', 'Onboarding call', 'SLA support'],
    highlight: false,
    cta: 'Get Agency',
  },
]

const FAQ_ITEMS = [
  { q: 'What does "one-time fee" mean?', a: 'You pay once and own the software forever. No monthly charges, no annual renewals, no seat fees. Updates are included for 12 months from your purchase date.' },
  { q: 'Can I upgrade later?', a: 'Yes — you pay only the price difference. Starter → Pro costs $100. Pro → Agency costs $200. You\'re never charged the full plan price again.' },
  { q: 'What\'s your refund policy?', a: 'Full refund within 14 days of purchase, no questions asked. Just email us at hello@devrel.studio.' },
  { q: 'Need a larger team?', a: 'The Agency plan includes 5 seats. Contact us directly for larger teams or custom enterprise arrangements.' },
]

function SettingSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-10">
      <div className="pt-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function BillingPage() {
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null)

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your plan and license. One-time fee — no subscriptions, ever.
          </p>
        </div>
        <AdminTourTriggerButton onStartTour={() => tourControls?.startTour()} />
      </div>

      <div className="space-y-10">

        {/* Current plan */}
        <SettingSection
          title="Current plan"
          description="Your active license. Upgrade any time — you only pay the price difference."
        >
          <div className="rounded-2xl bg-linear-to-br from-accent/10 via-accent/5 to-transparent border border-accent/25 p-6" data-tour="billing-plan">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-lg font-semibold text-foreground">Free Trial</span>
                    <Badge className="bg-accent/15 text-accent border-accent/30 text-xs">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Up to 10 content entries · 1 client workspace
                  </p>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">10</p>
                      <p className="text-xs text-muted-foreground">entries left</p>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">1</p>
                      <p className="text-xs text-muted-foreground">workspace</p>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">$0</p>
                      <p className="text-xs text-muted-foreground">paid so far</p>
                    </div>
                  </div>
                </div>
              </div>
              <Link href="/pricing" className="shrink-0">
                <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  Upgrade plan <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Trust bar */}
            <div className="mt-6 pt-5 border-t border-accent/15 flex flex-wrap items-center gap-5">
              {[
                { icon: ShieldCheck, label: '14-day money-back guarantee' },
                { icon: Zap,         label: 'Instant access after purchase' },
                { icon: Receipt,     label: 'Invoice included' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-accent" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </SettingSection>

        <Separator />

        {/* Plan comparison */}
        <SettingSection
          title="Choose a plan"
          description="Pay once, use forever. No recurring charges. Upgrade any time by paying only the price difference."
        >
          <div className="grid gap-4 sm:grid-cols-3" data-tour="billing-plans">
            {PLANS.map((plan) => {
              const Icon = plan.icon
              return (
                <div
                  key={plan.name}
                  className={`rounded-2xl border flex flex-col transition-shadow hover:shadow-md ${
                    plan.highlight
                      ? 'border-accent ring-1 ring-accent bg-card shadow-sm'
                      : 'border-border bg-card'
                  }`}
                >
                  {plan.highlight ? (
                    <div className="bg-accent text-accent-foreground text-xs font-semibold text-center py-1.5 rounded-t-2xl">
                      Most Popular
                    </div>
                  ) : (
                    <div className="h-7" />
                  )}

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${plan.highlight ? 'bg-accent/15' : 'bg-muted'}`}>
                        <Icon className={`h-4 w-4 ${plan.highlight ? 'text-accent' : 'text-muted-foreground'}`} />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                    </div>

                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                      <span className="text-xs text-muted-foreground">one-time</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{plan.description}</p>

                    <ul className="space-y-2 mb-5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      size="sm"
                      className={`w-full mt-auto ${plan.highlight ? 'bg-accent text-accent-foreground hover:bg-accent/90' : ''}`}
                      variant={plan.highlight ? 'default' : 'outline'}
                    >
                      {plan.cta}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            Need a custom arrangement?{' '}
            <Link href="mailto:hello@devrel.studio" className="text-accent hover:underline inline-flex items-center gap-1">
              Contact us <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </SettingSection>

        <Separator />

        {/* License & receipts */}
        <SettingSection
          title="License & receipts"
          description="After purchasing, your license key and invoices appear here. Download them any time for accounting."
        >
          <Card data-tour="billing-receipts">
            <CardContent className="p-6">
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No purchases yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Your license key and payment receipts will appear here after your first purchase.
                </p>
                <Link href="/pricing">
                  <Button size="sm" className="mt-5 bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
                    View plans <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </SettingSection>

        <Separator />

        {/* FAQ */}
        <SettingSection
          title="Billing FAQ"
          description="Common questions about our pricing and payment policies."
        >
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <AccordionItem
                key={q}
                value={`faq-${i}`}
                className="rounded-xl border border-border bg-card px-5 data-[state=open]:border-accent/40"
              >
                <AccordionTrigger className="text-sm font-medium text-foreground text-left hover:no-underline py-4">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className="mt-4 text-xs text-muted-foreground">
            Other questions?{' '}
            <Link href="mailto:hello@devrel.studio" className="text-accent hover:underline inline-flex items-center gap-1">
              Contact support <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </SettingSection>

      </div>

      <AdminTour
        variant={'billing' as TourVariant}
        autoStart
        onTourControlReady={setTourControls}
      />
    </main>
  )
}
