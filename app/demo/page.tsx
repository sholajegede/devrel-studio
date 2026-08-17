import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Live demo · DevRel Studio',
  description:
    'A real client performance dashboard, with content across all six categories. No sign-up.',
}

/**
 * Sends visitors to the seeded demo client dashboard.
 *
 * A redirect rather than a copy of the dashboard: the demo is only worth
 * anything if it is the same page a paying customer's client sees, reading the
 * same queries against the same schema. Maintaining a parallel mock would mean
 * the demo drifts from the product, which is the usual failure of demos.
 *
 * "Explore the demo" previously pointed at /dashboard, which is behind auth —
 * so the one link aimed at people without an account sent them to a sign-in
 * wall.
 */
export default function DemoPage() {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'
  const protocol = root.startsWith('localhost') ? 'http' : 'https'

  redirect(`${protocol}://demo.${root}`)
}
