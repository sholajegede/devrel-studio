import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export function MarketingNav() {
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
          <Link href="/dashboard" className="hidden sm:block">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/pricing">
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
