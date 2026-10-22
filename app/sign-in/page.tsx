import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSignedIn } from '@/lib/session'
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components'
import { ArrowRight } from 'lucide-react'
import { AuthShell } from '@/components/marketing/auth-shell'

/**
 * Signed-in visitors are sent straight to the dashboard.
 *
 * Kinde's own flow already bounces an authenticated user through, but they land
 * back on this page first, so someone who clicks a bookmarked /sign-in sees a
 * sign-in form they do not need. Checking on the server means they never see it
 * at all.
 */
export default async function SignInPage() {
  if (await isSignedIn()) redirect('/dashboard')

  return (
    <AuthShell
      panelTone="ochre"
      headline={
        <>
          Pick up
          <br />
          where you left off
        </>
      }
      body="Your entries, your clients and every dashboard are as you left them, with the numbers already refreshed."
      points={[
        'Log a piece of content in seconds',
        'Watch the numbers update on their own',
        'Give every client a live dashboard',
      ]}
    >
      <h2 className="text-4xl font-medium tracking-[-0.04em] text-foreground">Sign in</h2>
      <p className="mt-3 text-[15px] text-muted-foreground">
        New here?{' '}
        <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4 decoration-ink/30 hover:text-accent hover:decoration-accent">
          Create a free account
        </Link>
      </p>

      <LoginLink className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-[2rem_0.5rem_0.5rem_2rem] bg-accent text-base font-medium text-accent-foreground transition-colors hover:bg-ink">
        Continue with Kinde
        <ArrowRight className="h-4 w-4" />
      </LoginLink>

      <p className="mt-6 rounded-2xl bg-sand p-4 text-sm leading-relaxed text-muted-foreground">
        Kinde handles sign-in. Your password never touches DevRel Studio servers.
      </p>
    </AuthShell>
  )
}
