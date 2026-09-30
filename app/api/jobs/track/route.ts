import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { isBot } from '@/lib/view-tracking'

export const runtime = 'nodejs'

const MAX_BYTES = 12_000
const done = () => new NextResponse(null, { status: 204 })

/**
 * Job board analytics from the browser. It answers 204 to everything, including
 * bad input, so a tracking problem never shows up as a page problem. The
 * country comes from the host's edge header; no address is stored.
 */
export async function POST(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const secret = process.env.MANAGER_CODE_SECRET
  if (!convexUrl || !secret || isBot(req.headers.get('user-agent'))) return done()

  try {
    const text = await req.text()
    if (text.length > MAX_BYTES) return done()
    const body = JSON.parse(text) as Record<string, unknown>
    if (typeof body.visitor !== 'string' || !Array.isArray(body.events)) return done()

    const country = req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry') ?? undefined
    await new ConvexHttpClient(convexUrl).mutation(api.jobAnalytics.ingest, {
      secret,
      visitor: body.visitor,
      session: typeof body.session === 'string' ? body.session : undefined,
      device: typeof body.device === 'string' ? body.device : undefined,
      ref: typeof body.ref === 'string' ? body.ref : undefined,
      signedIn: body.signedIn === true,
      country: country && /^[A-Za-z]{2}$/.test(country) ? country : undefined,
      events: body.events.slice(0, 25),
    })
  } catch {
    // Nothing to do. The next batch will try again.
  }
  return done()
}
