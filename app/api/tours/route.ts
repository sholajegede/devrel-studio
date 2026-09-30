import { createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { isTourId } from '@/lib/tour-memory'

export const runtime = 'nodejs'

// Remembers which product tours an address has already seen, so a tour does
// not start again after someone changes browser. The address is hashed with a
// server secret before it is stored. Without TOURS_SECRET this does nothing
// and the browser copy is all that remains.

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip')
  )
}

function setup(req: NextRequest) {
  const secret = process.env.TOURS_SECRET
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const ip = clientIp(req)
  if (!secret || !url || !ip) return null
  return {
    secret,
    client: new ConvexHttpClient(url),
    hash: createHmac('sha256', secret).update(ip).digest('hex'),
  }
}

export async function GET(req: NextRequest) {
  const tour = req.nextUrl.searchParams.get('tour')
  if (!isTourId(tour)) return NextResponse.json({ error: 'Unknown tour' }, { status: 400 })
  const ctx = setup(req)
  if (!ctx) return NextResponse.json({ runs: 0, done: false })
  try {
    const state = await ctx.client.query(api.tours.ipGet, { secret: ctx.secret, hash: ctx.hash, tour })
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ runs: 0, done: false })
  }
}

export async function POST(req: NextRequest) {
  let body: { tour?: unknown; event?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!isTourId(body.tour) || (body.event !== 'start' && body.event !== 'done')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const ctx = setup(req)
  if (!ctx) return NextResponse.json({ ok: false })
  try {
    await ctx.client.mutation(api.tours.ipMark, { secret: ctx.secret, hash: ctx.hash, tour: body.tour, event: body.event })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
