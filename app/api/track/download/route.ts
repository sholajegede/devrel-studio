import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import {
  callerCity,
  callerCountry,
  callerIp,
  describeUserAgent,
  hashSessionTokenEdge,
  isBot,
  visitorHashEdge,
} from '@/lib/view-tracking'

// ── A report PDF was downloaded ───────────────────────────────────────────────
//
// The client dashboard builds its PDF in the browser and saves it locally, so
// the proxy never sees a download. The page posts here once the file is saved.
//
// It is recorded as a dashboard row with a `/download` path, through the same
// mutation as a page view. That keeps one rate limit, one dedupe window and one
// ownership check, and the manager attribution works the same way: the access
// code cookie for this dashboard is hashed here, never read by the browser.
//
// Paths: `/download/2026-09` for a monthly report, `/download` for the export
// of the whole dashboard.

const PERIOD = /^\d{4}-\d{2}$/

export async function POST(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const secret = process.env.MANAGER_CODE_SECRET
  if (!convexUrl || !secret) return new NextResponse(null, { status: 204 })

  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return new NextResponse(null, { status: 204 })

  try {
    const body = JSON.parse(await req.text()) as { target?: unknown; period?: unknown }
    const target = typeof body.target === 'string' ? body.target.trim().toLowerCase() : ''
    if (!/^[a-z0-9-]{1,63}$/.test(target)) return new NextResponse(null, { status: 204 })

    const period = typeof body.period === 'string' && PERIOD.test(body.period) ? body.period : null
    const visitorHash = await visitorHashEdge(callerIp(req.headers), userAgent, secret)

    const cookie = req.cookies.get(`mgr_session_${target}`)?.value
    const sessionTokenHash = cookie ? await hashSessionTokenEdge(cookie, secret) : undefined

    await new ConvexHttpClient(convexUrl).mutation(api.analytics.record, {
      surface: 'dashboard',
      target,
      path: period ? `/download/${period}` : '/download',
      visitorHash,
      sessionTokenHash,
      country: callerCountry(req.headers),
      city: callerCity(req.headers),
      ...describeUserAgent(userAgent),
    })
  } catch {
    // A missing download row is a missing detail, never an error the visitor sees.
  }

  return new NextResponse(null, { status: 204 })
}
