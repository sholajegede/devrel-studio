import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { api } from '@/convex/_generated/api'
import { hashInviteToken } from '@/lib/manager-auth'

export const runtime = 'nodejs'

/**
 * Claim an invitation. The raw token arrives from the link; only its hash is
 * ever sent to Convex, so the stored record stays useless on its own.
 */
export async function POST(req: NextRequest) {
  try {
    const { getIdTokenRaw } = getKindeServerSession()
    const idToken = await getIdTokenRaw()
    if (!idToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { token } = await req.json()
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) {
      return NextResponse.json({ error: 'Convex is not configured' }, { status: 500 })
    }

    const convex = new ConvexHttpClient(convexUrl)
    convex.setAuth(idToken)

    const result = await convex.mutation(api.members.acceptInvite, {
      tokenHash: hashInviteToken(token),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[members/accept] failed:', error)
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
