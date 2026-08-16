import React from "react"
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { AccessGate } from '@/components/subdomain/access-gate'
import { hashSessionToken, sessionCookieName } from '@/lib/manager-auth'

export const metadata: Metadata = {
  title: 'Performance Dashboard | DevRel Studio',
  description: 'Monthly content deliverables report for retained client',
}

/**
 * Access gate for [slug].devrel.studio.
 *
 * Managers have no devrel.studio account, so this is the only thing standing
 * between a client slug and the content behind it. It runs on the server on
 * every request — the dashboard is never sent to the browser unless the visitor
 * holds a valid session cookie, or the DevRel marked the dashboard public.
 */
export default async function PerformanceDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  // Without Convex there is no data to protect — let the page render its own
  // empty/error state rather than showing a gate that can never be satisfied.
  if (!convexUrl) return children

  const convex = new ConvexHttpClient(convexUrl)
  const gate = await convex.query(api.managerAccess.getGateInfo, { slug: subdomain })

  // No client with this slug, or no code configured yet: fall through to the
  // dashboard rather than locking the DevRel out of their own unconfigured
  // workspace. Setting a code is what turns the gate on.
  if (!gate.exists || (!gate.hasCode && !gate.isPublic)) {
    return children
  }

  if (gate.isPublic) {
    return children
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName(subdomain))?.value

  if (token) {
    const isValid = await convex.query(api.managerAccess.validateManagerSession, {
      slug: subdomain,
      tokenHash: hashSessionToken(token),
    })
    if (isValid) return children
  }

  return (
    <AccessGate
      slug={subdomain}
      clientName={gate.clientName}
      exists={gate.exists}
    />
  )
}
