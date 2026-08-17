import Link from 'next/link'
import Image from 'next/image'
import { isSignedIn } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { LayoutDashboard } from 'lucide-react'

/**
 * Marketing header.
 *
 * An async server component so it can read the session directly. Every page
 * that renders it is already server-rendered, and doing the check here means
 * the correct buttons are in the first HTML rather than appearing after
 * hydration — a signed-in user should never see "Sign in" flash at them.
 *
 * Signed in, the pair of call-to-action buttons collapses to one: someone with
 * an account does not need to be sold, they need the way back in.
 */
export async function MarketingNav() {
  const signedIn = await isSignedIn()

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/images/devrel-logo.png" alt="DevRel Studio" width={30} height={30} className="rounded" />
          <span className="text-base font-semibold text-foreground">
            devrel<span className="text-muted-foreground">.studio</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <Link href="/#features"     className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
          <Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
          <Link href="/pricing"       className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {signedIn ? (
            <Link href="/dashboard">
              <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="hidden sm:block">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  Start free
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
