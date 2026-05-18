'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { FileText, PlusCircle, LayoutDashboard, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminTourTriggerButton } from '@/components/admin-onboarding-tour'

const navItems = [
  { href: '/dashboard',         label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/dashboard/content', label: 'All Content', icon: FileText },
  { href: '/dashboard/add',     label: 'Add New',     icon: PlusCircle },
]

interface DashboardHeaderProps {
  tourControls?: { startTour: () => void } | null;
}

export function DashboardHeader({ tourControls }: DashboardHeaderProps = {}) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">

        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/images/devrel-logo.png"
              alt="DevRel Studio"
              width={28}
              height={28}
              className="rounded"
            />
            <span className="text-base font-semibold text-foreground">
              devrel<span className="text-muted-foreground">.studio</span>
            </span>
          </Link>

          <nav className="flex items-center gap-0.5" data-tour="admin-nav">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-secondary font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {tourControls && (
            <AdminTourTriggerButton onStartTour={tourControls.startTour} />
          )}
          <Link href="/kinde">
            <Button
              size="sm"
              className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 text-sm"
              data-tour="admin-view-btn"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View Performance Dashboard</span>
            </Button>
          </Link>
        </div>

      </div>
    </header>
  )
}
