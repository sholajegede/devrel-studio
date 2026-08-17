'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import {
  PLANS as PLAN_DEFS,
  PURCHASABLE_PLANS,
  type PlanId,
} from '@/convex/model/plans'
import {
  Check, Zap, ArrowRight, Crown, Building2, ExternalLink, Receipt,
  ShieldCheck, Loader2,
} from 'lucide-react'
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

// Presentation only — prices, limits and features come from convex/model/plans,
// which is the same definition the server enforces against.
const PLAN_ICONS: Record<PlanId, React.ElementType> = {
  free: Zap,
  starter: Zap,
  pro: Crown,
  agency: Building2,
}

const FAQ_ITEMS = [
  { q: 'How do I pay?', a: 'Pick a plan below and it opens an email. Say how many months you want, we send transfer details, and access opens once payment lands. Card payments are not available yet — Stripe requires a US entity.' },
  { q: 'What happens when access runs out?', a: 'Nothing is deleted. Your content stays and your clients’ dashboards stay online. You just cannot add or edit until access is extended.' },
  { q: 'Does extending early lose me time?', a: 'No. A new term is added to the end of your current window, never in place of it.' },
  { q: 'What’s your refund policy?', a: 'Full refund within 14 days of a payment, no questions asked. Email support@devrel.studio.' },
  { q: 'Need a larger team?', a: 'The Agency plan includes 5 seats. Contact us directly for larger teams.' },
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

/** "3 of 5 clients" — only rendered for limits the plan actually caps. */
function UsageStat({
  value,
  limit,
  label,
}: {
  value: number
  limit: number | null
  label: string
}) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-foreground tabular-nums">
        {value}
        {limit !== null && (
          <span className="text-sm font-normal text-muted-foreground"> / {limit}</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function BillingPageContent() {
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null)
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)
  const searchParams = useSearchParams()

  const billing = useQuery(api.billing.getMyPlan, {})

  /**
   * Card payments are not available: Stripe requires a US entity and this is
   * run from Nigeria. Rather than a checkout that cannot complete, this opens a
   * prefilled email — the buyer says which plan and for how long, pays by
   * transfer, and access is extended by hand.
   *
   * Prefilled because "email us" with a blank compose window loses people; the
   * plan and the account are already in the message.
   */
  const requestAccess = (plan: PlanId) => {
    const definition = PLAN_DEFS[plan]
    const subject = `DevRel Studio — ${definition.name} access`
    const body = [
      `I'd like ${definition.name} access for DevRel Studio.`,
      '',
      `Plan: ${definition.name}`,
      'Length: (1 month / 3 months / 6 months / 12 months)',
      '',
      'Please send payment details.',
    ].join('\n')

    window.location.href = `mailto:support@devrel.studio?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`
  }

  const currentPlanId = (billing?.plan ?? 'free') as PlanId
  const currentPlan = PLAN_DEFS[currentPlanId]
  const CurrentIcon = PLAN_ICONS[currentPlanId]

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your access window, and how to extend it.
          </p>
        </div>
        <AdminTourTriggerButton onStartTour={() => tourControls?.startTour()} />
      </div>

      <div className="space-y-10">

        {/* Current plan */}
        <SettingSection
          title="Current plan"
          description="The plan you are on now. Change it whenever you want."
        >
          <div className="rounded-2xl bg-linear-to-br from-accent/10 via-accent/5 to-transparent border border-accent/25 p-6" data-tour="billing-plan">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
                  <CurrentIcon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-lg font-semibold text-foreground">
                      {currentPlan.name}
                    </span>
                    <Badge className="bg-accent/15 text-accent border-accent/30 text-xs">
                      {billing?.isPaid ? 'Purchased' : 'Active'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentPlan.maxEntries === null
                      ? 'Unlimited content entries'
                      : `Up to ${currentPlan.maxEntries} content entries`}
                    {' · '}
                    {currentPlan.maxClients === null
                      ? 'unlimited client workspaces'
                      : `${currentPlan.maxClients} client workspace${
                          currentPlan.maxClients === 1 ? '' : 's'
                        }`}
                  </p>

                  {billing === undefined ? (
                    <div className="mt-4 h-8 w-48 animate-pulse rounded bg-muted/60" />
                  ) : (
                    <div className="flex items-center gap-4 mt-4">
                      <UsageStat
                        value={billing?.usage.entries ?? 0}
                        limit={currentPlan.maxEntries}
                        label="entries"
                      />
                      <Separator orientation="vertical" className="h-8" />
                      <UsageStat
                        value={billing?.usage.clients ?? 0}
                        limit={currentPlan.maxClients}
                        label={
                          (billing?.usage.clients ?? 0) === 1 ? 'workspace' : 'workspaces'
                        }
                      />
                      <Separator orientation="vertical" className="h-8" />
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">
                          ${currentPlan.price}
                        </p>
                        <p className="text-xs text-muted-foreground">paid so far</p>
                      </div>
                    </div>
                  )}

                  {billing?.purchasedAt && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Purchased{' '}
                      {new Date(billing.purchasedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>

              {currentPlanId !== 'agency' && (
                <a href="#plans" className="shrink-0">
                  <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                    Upgrade plan <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              )}
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
          description="Prices are monthly. Pay for more months at once and the rate drops."
        >
          <div id="plans" className="grid gap-4 sm:grid-cols-3 scroll-mt-8" data-tour="billing-plans">
            {PURCHASABLE_PLANS.map((planId) => {
              const plan = PLAN_DEFS[planId]
              const Icon = PLAN_ICONS[planId]
              const highlight = planId === 'pro'
              const isCurrent = planId === currentPlanId
              // Plans only move up. Each upgrade is charged at the new plan's
              // full price; there is no proration or delta pricing yet, and the
              // FAQ says so rather than promising a discount checkout won't give.
              const isDowngrade =
                PURCHASABLE_PLANS.indexOf(planId) <
                PURCHASABLE_PLANS.indexOf(currentPlanId as never)
              const isBusy = checkoutPlan === planId

              return (
                <div
                  key={planId}
                  className={`rounded-2xl border flex flex-col transition-shadow hover:shadow-md ${
                    isCurrent
                      ? 'border-accent ring-1 ring-accent bg-accent/5'
                      : highlight
                        ? 'border-accent ring-1 ring-accent bg-card shadow-sm'
                        : 'border-border bg-card'
                  }`}
                >
                  {isCurrent ? (
                    <div className="bg-accent text-accent-foreground text-xs font-semibold text-center py-1.5 rounded-t-2xl">
                      Your plan
                    </div>
                  ) : highlight ? (
                    <div className="bg-accent text-accent-foreground text-xs font-semibold text-center py-1.5 rounded-t-2xl">
                      Most Popular
                    </div>
                  ) : (
                    <div className="h-7" />
                  )}

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${highlight ? 'bg-accent/15' : 'bg-muted'}`}>
                        <Icon className={`h-4 w-4 ${highlight ? 'text-accent' : 'text-muted-foreground'}`} />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                    </div>

                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                      <span className="text-xs text-muted-foreground">/month</span>
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
                      onClick={() => requestAccess(planId)}
                      disabled={isCurrent || isDowngrade}
                      className={`w-full mt-auto gap-1.5 ${highlight && !isCurrent ? 'bg-accent text-accent-foreground hover:bg-accent/90' : ''}`}
                      variant={highlight && !isCurrent ? 'default' : 'outline'}
                    >
                      {isCurrent
                        ? 'Current plan'
                        : isDowngrade
                          ? 'Included in your plan'
                          : `Request ${plan.name}`}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            Need a custom arrangement?{' '}
            <Link href="mailto:support@devrel.studio" className="text-accent hover:underline inline-flex items-center gap-1">
              Contact us <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </SettingSection>

        <Separator />

        {/* License & receipts */}
        <SettingSection
          title="Payment record"
          description="Every payment you make shows up here with the date it cleared and the date access runs to."
        >
          <Card data-tour="billing-receipts">
            <CardContent className="p-6">
              {billing?.isPaid ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <Receipt className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {currentPlan.name} plan
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ${currentPlan.price} paid
                        {billing.purchasedAt &&
                          ` on ${new Date(billing.purchasedAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}`}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We email a receipt once the transfer clears.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No purchases yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Your first payment will show up here once it clears.
                  </p>
                  <a href="#plans">
                    <Button size="sm" className="mt-5 bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
                      View plans <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </SettingSection>

        <Separator />

        {/* FAQ */}
        <SettingSection
          title="Billing FAQ"
          description="How paying works."
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
            <Link href="mailto:support@devrel.studio" className="text-accent hover:underline inline-flex items-center gap-1">
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

/**
 * Suspense boundary for `useSearchParams` — Stripe returns the customer here
 * with `?purchase=success`, and reading it would otherwise opt the whole route
 * out of static rendering at build time.
 */
export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <main className="px-6 lg:px-10 py-8">
          <div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
        </main>
      }
    >
      <BillingPageContent />
    </Suspense>
  )
}
