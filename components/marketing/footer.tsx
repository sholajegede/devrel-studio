import Link from 'next/link'
import { Wordmark } from '@/components/brand/wordmark'
import { ShapeFamily } from '@/components/marketing/shapes'

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { href: '/#features', label: 'Product' },
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/demo', label: 'Live demo' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: '/jobs', label: 'DevRel jobs' },
      { href: '/hire', label: 'Hire a DevRel' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/contact', label: 'Contact' },
      { href: '/#faq', label: 'FAQ' },
      { href: 'mailto:support@devrel.studio', label: 'support@devrel.studio' },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="pt-20">
      <ShapeFamily />
      <div className="mx-auto max-w-[1600px] px-4 pb-4 sm:px-8">
        <div className="rounded-[2rem] bg-sand px-6 py-10 sm:px-12 sm:py-14">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <Wordmark />
              <p className="mt-8 max-w-sm text-2xl font-medium leading-[1.2] tracking-[-0.03em] text-foreground">
                DevRel Studio, built so every client can see what the work did.
              </p>
              <p className="mt-6 text-sm text-muted-foreground">
                Made by a developer advocate,
                <br />
                for developer advocates.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="text-sm text-muted-foreground">{col.title}</p>
                  <ul className="mt-4 space-y-3">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        <Link href={l.href} className="text-[15px] font-medium text-foreground transition-colors hover:text-accent">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {new Date().getFullYear()} DevRel Studio</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
