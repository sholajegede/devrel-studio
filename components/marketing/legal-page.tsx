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

      <article className="mx-auto max-w-3xl px-4 pb-8 pt-12 sm:px-8 sm:pt-20">
        <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-medium leading-[1] tracking-[-0.04em] text-foreground">
          {title}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated {updated}</p>

        {intro && (
          <p className="mt-10 rounded-[1.5rem] bg-sand p-7 text-lg leading-relaxed text-foreground">{intro}</p>
        )}

        <div className="mt-12 space-y-10">{children}</div>

        <p className="mt-16 border-t border-ink/10 pt-6 text-[15px] text-muted-foreground">
          Questions about this page?{' '}
          <Link
            href="/contact"
            className="font-medium text-foreground underline underline-offset-4 decoration-ink/30 hover:text-accent hover:decoration-accent"
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
      <h2 className="text-2xl font-medium tracking-[-0.03em] text-foreground">{heading}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
