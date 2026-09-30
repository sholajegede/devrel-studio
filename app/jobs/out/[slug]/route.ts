import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { isBot, visitorHashEdge } from '@/lib/view-tracking'

export const runtime = 'nodejs'

function tagged(url: string): string {
  try {
    const target = new URL(url)
    if (!target.searchParams.has('utm_source')) target.searchParams.set('utm_source', 'devrel.studio')
    return target.toString()
  } catch {
    return url
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const back = new URL(`/jobs/${slug}`, req.url)
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const secret = process.env.MANAGER_CODE_SECRET
  const userAgent = req.headers.get('user-agent')

  if (!convexUrl || !secret || isBot(userAgent)) return NextResponse.redirect(back, 302)

  try {
    const forwarded = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const bucket = await visitorHashEdge(forwarded, userAgent, secret)
    const applyUrl = await new ConvexHttpClient(convexUrl).mutation(api.jobs.recordClick, { slug, bucket })
    return NextResponse.redirect(tagged(applyUrl), 302)
  } catch {
    return NextResponse.redirect(back, 302)
  }
}
