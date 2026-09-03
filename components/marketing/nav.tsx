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
          {/* The wordmark is what gives way on a narrow screen, not a control.
              A phone header cannot hold the mark, the name, the theme toggle
              and both buttons, and of those the name is the only one nobody
              needs — the mark beside it says the same thing.

              440px rather than a stock breakpoint because that is where it
              stops being cramped when measured: at 400 the name and the theme
              toggle sit against each other with no gap, and the widest phone in
              portrait is 430. So every phone shows the mark alone and the name
              returns on anything larger. */}
          <span className="hidden min-[440px]:inline text-base font-semibold text-foreground">
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
              {/*
                Visible at every width.

                This was `hidden sm:block`, which took the only way back into
                the product off the header on every phone: there is no menu
                behind a hamburger here to hold it instead, so below 640px the
                site offered a returning customer nothing but "Start free".
                Signing up again is not a workaround — it is the same email
                address arriving at an account that already exists.
              */}
              <Link href="/sign-in">
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
