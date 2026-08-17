import type { Metadata } from 'next'
import Link from 'next/link'
import { ConvexHttpClient } from 'convex/browser'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { api } from '@/convex/_generated/api'
import { hashInviteToken } from '@/lib/manager-auth'
import { AcceptInvite } from '@/components/invite/accept-invite'
import { AlertCircle, Users } from 'lucide-react'

// The token is a credential, so this page must never be cached or prerendered.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workspace invitation | DevRel Studio',
  robots: { index: false, follow: false },
}

const REASONS: Record<string, string> = {
  'not-found': 'This invitation link is not valid. Ask whoever invited you to send a new one.',
  expired: 'This invitation has expired. Invitations are valid for 14 days — ask for a new one.',
  revoked: 'This invitation was revoked.',
  'already-accepted': 'This invitation has already been used. Try signing in.',
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-6 text-center">{children}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            devrel<span className="opacity-60">.studio</span>
          </Link>
        </p>
      </div>
    </div>
  )
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          Invitations are unavailable right now. Please try again later.
        </p>
      </Shell>
    )
  }

  const convex = new ConvexHttpClient(convexUrl)
  const invite = await convex.query(api.members.getInviteByToken, {
    tokenHash: hashInviteToken(token),
  })

  if (!invite.valid) {
    return (
      <Shell>
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {REASONS[invite.reason] ?? REASONS['not-found']}
        </p>
      </Shell>
    )
  }

  const { isAuthenticated } = getKindeServerSession()
  const signedIn = await isAuthenticated()

  return (
    <Shell>
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
        <Users className="h-5 w-5 text-accent" />
      </div>

      <h1 className="text-lg font-semibold text-foreground">
        Join {invite.workspaceName}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {invite.inviterName} invited you to collaborate as{' '}
        <span className="font-medium text-foreground">{invite.role}</span>.
      </p>

      <div className="mt-6">
        {signedIn ? (
          <AcceptInvite token={token} workspaceName={invite.workspaceName} />
        ) : (
          <>
            {/* Creating an account is the primary action, not signing in. Most
                people receiving an invitation have never used this before —
                offering only "sign in" is a dead end that reads as "you should
                already have an account", which is the opposite of an invitation.

                Kinde returns here afterwards either way, so the token survives
                the round trip and the invite is claimed without pasting it. */}
            <Link
              href={`/api/auth/register?post_login_redirect_url=${encodeURIComponent(
                `/invite/${token}`,
              )}`}
              className="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Create an account to accept
            </Link>

            <Link
              href={`/api/auth/login?post_login_redirect_url=${encodeURIComponent(
                `/invite/${token}`,
              )}`}
              className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              I already have an account
            </Link>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Invited as {invite.email}. Either route works and you can use any address — this
              link is what grants access, not the email it was sent to.
            </p>
          </>
        )}
      </div>
    </Shell>
  )
}
