import Link from 'next/link'
import { Wordmark } from '@/components/brand/wordmark'
import { SignedInSwitch } from '@/components/marketing/auth-aware'
import { NavLinks } from '@/components/marketing/nav-links'
import { MobileMenu } from '@/components/marketing/mobile-menu'
import { PrimaryLink } from '@/components/marketing/primitives'

/**
 * Marketing header.
 *
 * The session is read in the browser, not on the server, so every marketing
 * page that renders this header can stay static. A signed-in visitor sees
 * "Sign in" for a moment before it changes to "Dashboard". That is the cost of
 * static pages.
 *
 * Signed in, the pair of buttons collapses to one: someone with an account does
 * not need to be sold, they need the way back in.
 */
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Wordmark />

        <div className="flex items-center gap-2">
          <NavLinks />

          <SignedInSwitch
            signedIn={<PrimaryLink href="/dashboard" arrow={false} className="h-11 px-6 text-[15px]">Dashboard</PrimaryLink>}
            signedOut={
              <>
                {/* Visible at every width: a returning customer must always have a way back in. */}
                <Link
                  href="/sign-in"
                  className="inline-flex h-11 items-center rounded-full px-4 text-[15px] font-medium text-foreground transition-colors hover:bg-sand"
                >
                  Sign in
                </Link>
                <PrimaryLink href="/sign-up" arrow={false} className="h-11 px-6 text-[15px]">
                  Start free
                </PrimaryLink>
              </>
            }
          />
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}
