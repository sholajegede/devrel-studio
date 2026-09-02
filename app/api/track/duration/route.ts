import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { callerIp, isBot, visitorHashEdge } from '@/lib/view-tracking'

// ── How long they stayed ──────────────────────────────────────────────────────
//
// The view itself is recorded by proxy.ts on the way in. This route records the
// other half — how long the visitor was actually on the page — which arrives
// later, from the browser, on unload.
//
// The visitor hash is *recomputed here* rather than handed over by the client.
// It is derived from the same IP, user agent and daily salt the proxy used, so
// the same visitor produces the same hash and the duration finds its view. Two
// things follow from doing it this way: nothing is stored on the visitor's
// device, so the section's "no cookies" claim stays true; and the hash cannot
// be forged, because the browser never sees it and could not attach a duration
// to somebody else's visit.

export async function POST(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const secret = process.env.MANAGER_CODE_SECRET
  if (!convexUrl || !secret) return new NextResponse(null, { status: 204 })

  const userAgent = req.headers.get('user-agent')
  if (isBot(userAgent)) return new NextResponse(null, { status: 204 })

  try {
    // sendBeacon posts a Blob, so the body is read as text and parsed by hand.
    const body = JSON.parse(await req.text()) as {
      target?: unknown
      durationMs?: unknown
    }

    const target = typeof body.target === 'string' ? body.target : ''
    const durationMs = Number(body.durationMs)
    if (!target || !Number.isFinite(durationMs) || durationMs <= 0) {
      return new NextResponse(null, { status: 204 })
    }

    const visitorHash = await visitorHashEdge(callerIp(req.headers), userAgent, secret)

    const convex = new ConvexHttpClient(convexUrl)
    await convex.mutation(api.analytics.recordDuration, {
      target,
      visitorHash,
      durationMs: Math.round(durationMs),
    })
  } catch {
    // A missing duration is a missing detail on one row, never an error the
    // visitor should see.
  }

  return new NextResponse(null, { status: 204 })
}
