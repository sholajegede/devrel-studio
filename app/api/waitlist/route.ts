import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { hashClientIp } from '@/lib/manager-auth'

export const runtime = 'nodejs'

// The waitlist form posts here. It goes through a route handler rather than
// calling Convex from the browser so the form keeps working on marketing pages
// even when the Convex provider is unconfigured, and so we can trim and
// length-check the free-text fields in one place.

const MAX_LENGTHS = {
  email: 254,
  name: 120,
  company: 120,
  role: 120,
  useCase: 2_000,
} as const

/** Loose on purpose — the real check is the confirmation email, not a regex. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, max)
  return trimmed || undefined
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>

  const email = text(payload.email, MAX_LENGTHS.email)?.toLowerCase()
  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { message: 'Enter a valid email address' },
      { status: 400 },
    )
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    console.error('[waitlist] NEXT_PUBLIC_CONVEX_URL is not set')
    return NextResponse.json(
      { message: 'Signups are temporarily unavailable. Please try again later.' },
      { status: 503 },
    )
  }

  try {
    // Signing up twice reports success — see the mutation for why.
    const result = await new ConvexHttpClient(convexUrl).mutation(
      api.waitlist.addToWaitlist,
      {
        email,
      // Hashed here so Convex never stores a raw address; the rate limiter
      // needs a stable identifier, not an identity.
      ipHash: hashClientIp(
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          req.headers.get('x-real-ip'),
      ),
        name: text(payload.name, MAX_LENGTHS.name),
        company: text(payload.company, MAX_LENGTHS.company),
        role: text(payload.role, MAX_LENGTHS.role),
        useCase: text(payload.useCase, MAX_LENGTHS.useCase),
      },
    )

    return NextResponse.json({ ok: true, alreadyJoined: result.alreadyJoined })
  } catch (error) {
    console.error('[waitlist] signup failed:', error)
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
