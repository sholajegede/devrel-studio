import { NextRequest, NextResponse } from 'next/server'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { isPlanId, PLANS, PURCHASABLE_PLANS } from '@/convex/model/plans'
import { appOrigin, billingIsConfigured, priceIdFor, stripeClient } from '@/lib/stripe'

export const runtime = 'nodejs'

/**
 * POST { plan } — unused while payments are manual; kept for when Stripe becomes available.
 *
 * The plan is never trusted from the client beyond "which of the three": the
 * amount comes from the Stripe price, and the account's plan is only written
 * later by the webhook, after Stripe confirms payment.
 */
export async function POST(req: NextRequest) {
  const stripe = stripeClient()
  if (!stripe || !billingIsConfigured()) {
    return NextResponse.json(
      { error: 'Billing is not configured on this deployment' },
      { status: 503 },
    )
  }

  const { getUser } = getKindeServerSession()
  const user = await getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let plan: unknown
  try {
    ;({ plan } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!isPlanId(plan) || !PURCHASABLE_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
  }

  const priceId = priceIdFor(plan)
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for the ${PLANS[plan].name} plan` },
      { status: 503 },
    )
  }

  try {
    const origin = appOrigin(req.url)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      // The webhook reads these back — it is the only place the plan is applied.
      metadata: { kindeId: user.id, plan },
      payment_intent_data: {
        metadata: { kindeId: user.id, plan },
      },
      success_url: `${origin}/dashboard/billing?purchase=success`,
      cancel_url: `${origin}/dashboard/billing?purchase=cancelled`,
      allow_promotion_codes: true,
    })

    if (!session.url) {
      throw new Error('Stripe returned a session without a URL')
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[billing/checkout] failed:', error)
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 500 },
    )
  }
}
