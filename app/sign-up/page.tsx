import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSignedIn } from '@/lib/session'
import Image from 'next/image'
import { RegisterLink } from '@kinde-oss/kinde-auth-nextjs/components'
import { ArrowRight, Check } from 'lucide-react'

const PLAN_PERKS = [
  '14 days free. No card needed',
  'One client workspace, up to 10 entries',
  'All six content categories',
  'A live dashboard your client can open',
  'Nothing to cancel when it ends',
]

/**
 * Signed-in visitors are sent straight to the dashboard.
 *
 * Kinde's own flow already bounces an authenticated user through, but they land
 * back on this page first — so someone who clicks a bookmarked /sign-in sees a
 * sign-in form they do not need. Checking on the server means they never see it
 * at all.
 */
export default async function SignUpPage() {
  if (await isSignedIn()) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] shrink-0 flex-col bg-[#232931] p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        <Link href="/" className="flex items-center gap-2.5 relative z-10">
          <Image src="/images/devrel-logo.png" alt="DevRel Studio" width={32} height={32} className="rounded" />
          <span className="text-base font-semibold text-white">
            devrel<span className="text-white/40">.studio</span>
          </span>
        </Link>

        <div className="flex-1 flex flex-col justify-center relative z-10 py-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 mb-6 w-fit">
            <span className="text-xs font-medium text-accent">14 days free · No card</span>
          </div>
          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-6">
            Start proving your<br />DevRel impact today.
          </h1>
          <p className="text-white/50 text-base leading-relaxed mb-10">
            Join developer advocates who use DevRel Studio to log their work and share live dashboards with every client.
          </p>

          <ul className="space-y-3.5">
            {PLAN_PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-sm text-white/60">
                <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-accent" />
                </div>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/20 relative z-10">
          &copy; {new Date().getFullYear()} DevRel Studio · 14 days free, no card required
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="lg:hidden mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/devrel-logo.png" alt="DevRel Studio" width={28} height={28} className="rounded" />
            <span className="text-base font-semibold text-foreground">
              devrel<span className="text-muted-foreground">.studio</span>
            </span>
          </Link>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Create your account</h2>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-accent hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>

          {/* Register CTA — delegates to Kinde */}
          <RegisterLink className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors">
            Get started free
            <ArrowRight className="h-4 w-4" />
          </RegisterLink>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">Secure sign-up via Kinde</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed">
            Kinde handles authentication securely. After signing up you&apos;ll be taken straight to your dashboard.
          </div>

          {/* Mini plan preview */}
          <div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-4">
            <p className="text-xs font-semibold text-foreground mb-3">What the free trial includes</p>
            <ul className="space-y-2">
              {PLAN_PERKS.slice(0, 3).map((perk) => (
                <li key={perk} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 text-accent shrink-0" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{' '}
            <Link href="/" className="hover:underline">Terms</Link>
            {' '}and{' '}
            <Link href="/" className="hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
