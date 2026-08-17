import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'

/**
 * Shared shell for the long-form pages — privacy, terms.
 *
 * Narrow measure and generous leading: these are documents people actually have
 * to read, and the rest of the site's density works against that.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string
  updated: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <article className="mx-auto max-w-2xl px-6 py-24">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Legal
        </span>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>

        {intro && (
          <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">{intro}</p>
        )}

        <div className="mt-10 space-y-8">{children}</div>

        <p className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          Questions about this page?{' '}
          <Link
            href="/contact"
            className="text-foreground underline underline-offset-4 hover:text-accent"
          >
            Get in touch
          </Link>
          .
        </p>
      </article>

      <MarketingFooter />
    </div>
  )
}

export function Section({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-[15px] font-medium text-foreground">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
