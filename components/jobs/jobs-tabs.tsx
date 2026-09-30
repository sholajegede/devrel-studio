'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard/jobs', label: 'Discover', exact: true },
  { href: '/dashboard/jobs/tracker', label: 'Tracker' },
  { href: '/dashboard/jobs/alerts', label: 'Alerts' },
  { href: '/dashboard/jobs/profile', label: 'CV & preferences' },
]

export function JobsHeader({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
      <nav aria-label="Jobs sections" className="mt-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-accent font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
