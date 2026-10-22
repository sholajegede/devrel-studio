import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSignedIn } from '@/lib/session'
import { RegisterLink } from '@kinde-oss/kinde-auth-nextjs/components'
import { ArrowRight } from 'lucide-react'
import { AuthShell } from '@/components/marketing/auth-shell'

const PLAN_PERKS = [
  '14 days free, no card',
  'One client workspace, up to 10 entries',
  'All six content categories',
  'A live dashboard your client can open',
  'The DevRel job board, free always',
  'Nothing to cancel when it ends',
]

/**
 * Signed-in visitors are sent straight to the dashboard, for the same reason as
 * on /sign-in: an account holder has no use for a sign-up form.
 */
export default async function SignUpPage() {
  if (await isSignedIn()) redirect('/dashboard')

  return (
    <AuthShell
      panelTone="blue"
      headline={
        <>
          Start showing
          <br />
          what your work did
        </>
      }
      body="Join the advocates who log their work in one place and give every client a live dashboard."
      points={PLAN_PERKS}
    >
      <h2 className="text-4xl font-medium tracking-[-0.04em] text-foreground">Create your account</h2>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Already have one?{' '}
        <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4 decoration-ink/30 hover:text-accent hover:decoration-accent">
          Sign in
        </Link>
      </p>

      <RegisterLink className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-[2rem_0.5rem_0.5rem_2rem] bg-accent text-base font-medium text-accent-foreground transition-colors hover:bg-ink">
        Get started free
        <ArrowRight className="h-4 w-4" />
      </RegisterLink>

      <p className="mt-6 rounded-2xl bg-sand p-4 text-sm leading-relaxed text-muted-foreground">
        Kinde handles sign-up. When it finishes you land straight on your dashboard.
      </p>
    </AuthShell>
  )
}
