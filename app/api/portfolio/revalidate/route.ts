import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { ConvexHttpClient } from 'convex/browser'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { api } from '@/convex/_generated/api'

export const runtime = 'nodejs'

/**
 * Refresh the caller's own public portfolio.
 *
 * The page is statically revalidated every 5 minutes, which is the right default
 * for a page nobody is watching — but it means publishing something and then
 * sending the link straight to a client shows them the old page. Content writes
 * happen inside Convex, which cannot reach Next's cache, so the dashboard calls
 * this after a mutation instead.
 *
 * Callers can only ever revalidate their own handle: it is read from the signed-in
 * user's profile, never taken from the request body.
 */
export async function POST() {
  try {
    const { getIdTokenRaw } = getKindeServerSession()
    const token = await getIdTokenRaw()
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) {
      return NextResponse.json({ ok: false, reason: 'convex-not-configured' })
    }

    const convex = new ConvexHttpClient(convexUrl)
    convex.setAuth(token)

    const profile = await convex.query(api.users.getCurrentUserProfile, {})
    const handle = profile?.handle

    // No claimed handle means no public page to refresh — not an error.
    if (!handle) return NextResponse.json({ ok: true, revalidated: false })

    revalidatePath(`/portfolio/${handle}`)

    return NextResponse.json({ ok: true, revalidated: true, handle })
  } catch (error) {
    console.error('[portfolio/revalidate] failed:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
