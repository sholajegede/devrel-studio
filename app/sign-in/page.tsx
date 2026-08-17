import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSignedIn } from '@/lib/session'
import Image from 'next/image'
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components'
import { ArrowRight, BarChart3, FileText, Share2 } from 'lucide-react'

const FEATURES = [
  { icon: FileText,  text: 'Log a piece of content in seconds' },
  { icon: BarChart3, text: 'Watch the numbers update on their own' },
  { icon: Share2,    text: 'Give every client a live dashboard' },
]

/**
 * Signed-in visitors are sent straight to the dashboard.
 *
 * Kinde's own flow already bounces an authenticated user through, but they land
 * back on this page first — so someone who clicks a bookmarked /sign-in sees a
 * sign-in form they do not need. Checking on the server means they never see it
 * at all.
 */
export default async function SignInPage() {
  if (await isSignedIn()) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] shrink-0 flex-col bg-[#232931] p-10 relative overflow-hidden">
        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 relative z-10">
          <Image src="/images/devrel-logo.png" alt="DevRel Studio" width={32} height={32} className="rounded" />
          <span className="text-base font-semibold text-white">
            devrel<span className="text-white/40">.studio</span>
          </span>
        </Link>

        <div className="flex-1 flex flex-col justify-center relative z-10 py-12">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-4">Welcome back</p>
          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-6">
            Your DevRel work<br />is worth showing off.
          </h1>
          <p className="text-white/50 text-base leading-relaxed mb-10">
            Sign in to your DevRel Studio workspace and pick up right where you left off.
          </p>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/60">
                <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/20 relative z-10">
          &copy; {new Date().getFullYear()} DevRel Studio
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
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
            <h2 className="text-2xl font-bold text-foreground mb-2">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/sign-up" className="text-accent hover:underline font-medium">
                Create one free
              </Link>
            </p>
          </div>

          {/* Sign-in CTA — delegates to Kinde */}
          <LoginLink className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors">
            Continue with Kinde
            <ArrowRight className="h-4 w-4" />
          </LoginLink>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">Secure authentication via Kinde</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed">
            Kinde handles authentication. Your credentials are never stored on DevRel Studio servers.
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
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
