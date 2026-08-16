import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { api } from '@/convex/_generated/api'
import { generateInviteToken, hashInviteToken } from '@/lib/manager-auth'
import { siteOrigin } from '@/lib/site'

export const runtime = 'nodejs'

/**
 * Invite someone to the caller's workspace.
 *
 * The token is generated here, not in Convex: mutations have to be
 * deterministic, so they cannot produce randomness. Convex stores only the hash,
 * which means a dump of `workspaceInvites` yields no working invitation link.
 *
 * Ownership is enforced inside `members:inviteMember` — this route only holds
 * the crypto.
 */
export async function POST(req: NextRequest) {
  try {
    const { getIdTokenRaw } = getKindeServerSession()
    const idToken = await getIdTokenRaw()
    if (!idToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { email, role } = await req.json()
    if (typeof email !== 'string' || typeof role !== 'string') {
      return NextResponse.json({ error: 'Missing email or role' }, { status: 400 })
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) {
      return NextResponse.json({ error: 'Convex is not configured' }, { status: 500 })
    }

    const convex = new ConvexHttpClient(convexUrl)
    convex.setAuth(idToken)

    const token = generateInviteToken()
    const invite = await convex.mutation(api.members.inviteMember, {
      email,
      role: role as 'admin' | 'editor' | 'viewer',
      tokenHash: hashInviteToken(token),
    })

    const acceptUrl = `${siteOrigin()}/invite/${token}`

    // The record is what matters; a failed email leaves a revocable invite and a
    // link the owner can copy, so it must not fail the request.
    let emailed = false
    try {
      await convex.mutation(api.members.sendInviteEmail, {
        email,
        inviterName: invite.inviterName,
        role,
        acceptUrl,
      })
      emailed = true
    } catch (error) {
      console.error('[members/invite] could not send the invitation email:', error)
    }

    return NextResponse.json({ ok: true, acceptUrl, emailed })
  } catch (error) {
    console.error('[members/invite] failed:', error)
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
