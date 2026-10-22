'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export const NAV_LINKS = [
  { href: '/#features', label: 'Product', match: '/' },
  { href: '/jobs', label: 'Jobs', match: '/jobs' },
  { href: '/hire', label: 'Hire', match: '/hire' },
  { href: '/blog', label: 'Blog', match: '/blog' },
  { href: '/pricing', label: 'Pricing', match: '/pricing' },
]

function isActive(pathname: string, match: string) {
  if (match === '/') return pathname === '/'
  return pathname === match || pathname.startsWith(`${match}/`)
}

/** The pill of links. The current section turns orange. */
export function NavLinks() {
  const pathname = usePathname() ?? '/'
  return (
    <nav
      aria-label="Main"
      className="hidden items-center gap-1 rounded-[1rem_2rem_2rem_1rem] bg-sand px-3 py-2.5 md:flex"
    >
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'rounded-full px-3.5 py-1 text-[15px] font-medium transition-colors',
            isActive(pathname, link.match) ? 'text-accent' : 'text-foreground hover:text-accent',
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
