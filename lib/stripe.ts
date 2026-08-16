import 'server-only'
import Stripe from 'stripe'
import { PlanId, PURCHASABLE_PLANS } from '@/convex/model/plans'

// ── Stripe ────────────────────────────────────────────────────────────────────
//
// Everything here is lazy. Billing is optional configuration: a deployment
// without Stripe keys should still run, with the billing page saying so rather
// than the whole app failing to boot.

let cached: Stripe | null = null

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null

  if (!cached) {
    cached = new Stripe(key, {
      // Pinned so a Stripe-side API bump cannot silently change behaviour.
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
    })
  }

  return cached
}

/**
 * Stripe price id for a plan, e.g. STRIPE_PRICE_PRO.
 *
 * Prices live in the Stripe dashboard rather than in code so they can be
 * changed without a deploy — the app only needs to know which price is which
 * plan.
 */
export function priceIdFor(plan: PlanId): string | null {
  if (!PURCHASABLE_PLANS.includes(plan)) return null
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] ?? null
}

export function billingIsConfigured(): boolean {
  return (
    !!process.env.STRIPE_SECRET_KEY &&
    PURCHASABLE_PLANS.every((plan) => !!priceIdFor(plan))
  )
}

/** Absolute origin for Stripe's return URLs, which cannot be relative. */
export function appOrigin(requestUrl: string): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.KINDE_SITE_URL ??
    new URL(requestUrl).origin
  )
}
