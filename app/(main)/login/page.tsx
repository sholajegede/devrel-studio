import Link from 'next/link'
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components'
import { ShieldCheck } from 'lucide-react'
import { siteOrigin } from '@/lib/site'

// ── The console's front door ──────────────────────────────────────────────────
//
// admin.devrel.studio/login, and the only page on that host anybody can reach
// without a session.
//
// It exists rather than bouncing straight to Kinde because somebody arriving at
// this address may not be an admin at all, and a sign-in screen for the product
// appearing on a host called "admin" is how a customer ends up believing they
// are supposed to have an account here.
//
// The page says nothing about who *can* sign in. Confirming that the address is
// real is unavoidable — it answered — but confirming that a particular person
// is an administrator is not, and the console renders the same "not found" as
// any unknown URL for an account without the role.

export const metadata = {
  title: 'Sign in · devrel.studio admin',
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            devrel.studio admin
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Running the platform, as distinct from running a workspace. Everything
          here is recorded against the account that signs in.
        </p>

        {/*
          Back to this host afterwards, not to the product. Kinde needs the
          address on its allowed post-login list; without it the flow completes
          and lands on the dashboard instead, which looks like the sign-in
          silently failing.
        */}
        <LoginLink
          postLoginRedirectURL="/"
          className="mt-6 flex h-10 w-full items-center justify-center rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Continue
        </LoginLink>

        <p className="mt-6 text-xs text-muted-foreground">
          Looking for your own dashboard?{' '}
          <Link
            href={siteOrigin()}
            className="underline underline-offset-4 hover:text-foreground"
          >
            devrel.studio
          </Link>
        </p>
      </div>
    </main>
  )
}
