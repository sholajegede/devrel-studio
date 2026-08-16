import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import {
  SESSION_MAX_AGE_SECONDS,
  generateSessionToken,
  hashAccessCode,
  hashClientIp,
  hashSessionToken,
  sessionCookieName,
} from '@/lib/manager-auth'

export const runtime = 'nodejs'

function convexClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL as string)
}

/**
 * Left-most x-forwarded-for entry is the original caller. It is spoofable, which
 * is exactly why the slug-wide counter exists alongside the per-IP one.
 */
function callerIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

/** POST { slug, code } — exchange an access code for a manager session cookie. */
export async function POST(req: NextRequest) {
  try {
    const { slug, code } = await req.json()

    if (typeof slug !== 'string' || typeof code !== 'string' || !slug || !code) {
      return NextResponse.json({ error: 'Missing slug or code' }, { status: 400 })
    }

    const token = generateSessionToken()
    const result = await convexClient().mutation(api.managerAccess.redeemAccessCode, {
      slug,
      codeHash: hashAccessCode(slug, code),
      tokenHash: hashSessionToken(token),
      ipHash: hashClientIp(callerIp(req)),
    })

    if (!result.ok) {
      if (result.retryAfterMs) {
        const minutes = Math.max(1, Math.ceil(result.retryAfterMs / 60_000))
        return NextResponse.json(
          {
            error: `Too many incorrect codes. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) },
          },
        )
      }

      // Deliberately vague: do not reveal whether the slug or the code was wrong.
      return NextResponse.json({ error: 'That code is not valid' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(sessionCookieName(slug), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
    return response
  } catch (error) {
    console.error('[manager-access] redeem failed:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/** DELETE ?slug=... — sign the manager out of this dashboard. */
export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
  }

  const cookieName = sessionCookieName(slug)
  const token = req.cookies.get(cookieName)?.value

  if (token) {
    try {
      await convexClient().mutation(api.managerAccess.endManagerSession, {
        tokenHash: hashSessionToken(token),
      })
    } catch (error) {
      console.error('[manager-access] session cleanup failed:', error)
    }
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.delete(cookieName)
  return response
}
