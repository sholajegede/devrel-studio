'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { ContentEntry, Status } from '@/lib/types'
import { categoryOf } from '@/lib/metrics'
import { CATEGORY_META, getCategoryColor } from '@/lib/category-meta'
import { PlatformIcon } from '@/lib/platform-meta'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUserContext } from '@/contexts/user-context'
import PageLoader from '@/components/page-loader'
import {
  AdminTour,
  AdminTourTriggerButton,
  TourVariant,
} from '@/components/admin-onboarding-tour'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  PlusCircle,
} from 'lucide-react'

// ── Pipeline ──────────────────────────────────────────────────────────────────
//
// Everything else in the app looks backwards at what shipped. This is the
// forward-looking view: what is in flight, what is due, and what has slipped.
//
// The lanes are the existing `status` values, so this needed no new schema —
// only a narrow mutation to move an entry between them.

const LANES: {
  status: Status
  label: string
  hint: string
  icon: React.ElementType
  accent: string
}[] = [
  {
    status: 'Draft',
    label: 'Draft',
    hint: 'Being written',
    icon: Pencil,
    accent: 'border-t-stone-400',
  },
  {
    status: 'Waiting Approval',
    label: 'In Review',
    hint: 'With the client',
    icon: Clock,
    accent: 'border-t-amber-400',
  },
  {
    status: 'Scheduled',
    label: 'Scheduled',
    hint: 'Date locked in',
    icon: CalendarClock,
    accent: 'border-t-sky-400',
  },
  {
    status: 'Published',
    label: 'Published',
    hint: 'Shipped',
    icon: CheckCircle2,
    accent: 'border-t-emerald-500',
  },
]

/** Local midnight — comparing against `new Date()` would call today overdue. */
function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function isOverdue(entry: ContentEntry): boolean {
  if (entry.status === 'Published') return false
  if (!entry.publicationDate) return false
  return new Date(entry.publicationDate) < startOfToday()
}

function formatDue(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  const days = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      startOfToday().getTime()) /
      86_400_000,
  )

  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return '1 day late'
  if (days < 0) return `${Math.abs(days)} days late`
  if (days <= 14) return `in ${days} days`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Card ──────────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onMove,
  tourAnchor = false,
}: {
  entry: ContentEntry
  onMove: (id: Id<'contentEntries'>, status: Status) => void
  tourAnchor?: boolean
}) {
  const category = categoryOf(entry)
  const Icon = CATEGORY_META[category].icon
  const overdue = isOverdue(entry)

  return (
    <div
      className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/20"
      data-tour={tourAnchor ? 'pipeline-card' : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/edit/${entry._id}`}
          className="min-w-0 flex-1 text-sm font-medium text-foreground hover:text-accent transition-colors line-clamp-2"
        >
          {entry.title || 'Untitled'}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Move entry"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel>
            {LANES.filter((lane) => lane.status !== entry.status).map((lane) => (
              <DropdownMenuItem
                key={lane.status}
                onClick={() => onMove(entry._id, lane.status)}
                className="gap-2 text-sm"
              >
                <lane.icon className="h-3.5 w-3.5" />
                {lane.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/edit/${entry._id}`} className="gap-2 text-sm">
                <Pencil className="h-3.5 w-3.5" />
                Edit entry
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Badge variant="outline" className={`gap-1 text-[10px] ${getCategoryColor(category)}`}>
          <Icon className="h-2.5 w-2.5" />
          {category}
        </Badge>
        {entry.platform && (
          <span className="inline-flex items-center gap-1">
            <PlatformIcon platform={entry.platform} size={12} />
            {entry.platform}
          </span>
        )}
      </div>

      {entry.publicationDate && (
        <p
          className={`mt-2 inline-flex items-center gap-1 text-xs ${
            overdue ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
          }`}
        >
          {overdue ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <CalendarClock className="h-3 w-3" />
          )}
          {formatDue(entry.publicationDate)}
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { profile } = useUserContext()
  const [clientFilter, setClientFilter] = useState('all')
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null)

  const content = useQuery(api.content.getAllContent, profile?._id ? {} : 'skip')
  const setStatus = useMutation(api.content.setContentStatus)

  const entries = useMemo(
    () => (content ? (content as ContentEntry[]) : []),
    [content],
  )

  const clients = useMemo(
    () => Array.from(new Set(entries.map((e) => e.client).filter(Boolean))).sort(),
    [entries],
  )

  const visible = useMemo(
    () =>
      clientFilter === 'all'
        ? entries
        : entries.filter((e) => e.client === clientFilter),
    [entries, clientFilter],
  )

  // Published is capped: the lane is there for context, not as an archive —
  // that is what All Content is for.
  const lanes = useMemo(() => {
    return LANES.map((lane) => {
      const all = visible
        .filter((e) => e.status === lane.status)
        .sort((a, b) => {
          // Unpublished sorts by soonest due; published by most recent.
          const order = a.publicationDate.localeCompare(b.publicationDate)
          return lane.status === 'Published' ? -order : order
        })

      return {
        ...lane,
        total: all.length,
        entries: lane.status === 'Published' ? all.slice(0, 8) : all,
      }
    })
  }, [visible])

  // The tour points at a single card. Use the first lane that actually has one,
  // since Draft is frequently empty and an anchor on nothing skips the step.
  const anchorLane = useMemo(
    () => lanes.find((lane) => lane.entries.length > 0)?.status,
    [lanes],
  )

  const overdue = useMemo(() => visible.filter(isOverdue), [visible])

  const upcoming = useMemo(() => {
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 14)
    return visible.filter(
      (e) =>
        e.status !== 'Published' &&
        !isOverdue(e) &&
        e.publicationDate &&
        new Date(e.publicationDate) <= horizon,
    ).length
  }, [visible])

  const handleMove = async (id: Id<'contentEntries'>, status: Status) => {
    try {
      await setStatus({ id, status })
      toast.success(`Moved to ${LANES.find((l) => l.status === status)?.label}`)
    } catch (error) {
      console.error('[pipeline] status change failed:', error)
      toast.error('Could not move that entry')
    }
  }

  if (content === undefined) return <PageLoader />

  return (
    <main className="px-6 lg:px-10 py-8">

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground" data-tour="pipeline-summary">
            {visible.filter((e) => e.status !== 'Published').length} in flight
            {overdue.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {' '}
                · {overdue.length} past its date
              </span>
            )}
            {upcoming > 0 && <span> · {upcoming} due in the next 2 weeks</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminTourTriggerButton onStartTour={() => tourControls?.startTour()} />
          {clients.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 bg-transparent"
                  data-tour="pipeline-filter"
                >
                  {clientFilter === 'all' ? 'All clients' : clientFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setClientFilter('all')}>
                  All clients
                </DropdownMenuItem>
                {clients.map((client) => (
                  <DropdownMenuItem key={client} onClick={() => setClientFilter(client!)}>
                    {client}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Link href="/dashboard/add">
            <Button size="sm" className="gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />
              Add Entry
            </Button>
          </Link>
        </div>
      </div>

      {/* Overdue callout — the one thing worth interrupting for */}
      {overdue.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {overdue.length} {overdue.length === 1 ? 'entry is' : 'entries are'} past
                  the planned date
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  {overdue
                    .slice(0, 3)
                    .map((e) => e.title || 'Untitled')
                    .join(' · ')}
                  {overdue.length > 3 && ` · +${overdue.length - 3} more`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Board */}
      {entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <p className="text-muted-foreground">Nothing in the pipeline yet.</p>
          <Link href="/dashboard/add" className="mt-4 inline-block">
            <Button size="sm" className="gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />
              Add your first entry
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-tour="pipeline-board">
          {lanes.map((lane) => (
            <section key={lane.status} className="min-w-0">
              <div
                className={`mb-3 flex items-center justify-between border-t-2 pt-3 ${lane.accent}`}
              >
                <div className="flex items-center gap-2">
                  <lane.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-foreground">{lane.label}</h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {lane.total}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {lane.entries.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    {lane.hint}
                  </p>
                ) : (
                  lane.entries.map((entry, entryIndex) => (
                    <EntryCard
                      key={entry._id}
                      entry={entry}
                      onMove={handleMove}
                      tourAnchor={lane.status === anchorLane && entryIndex === 0}
                    />
                  ))
                )}

                {lane.total > lane.entries.length && (
                  <Link
                    href="/dashboard/content"
                    className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {lane.total - lane.entries.length} more
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Tour */}
      <AdminTour
        variant={'pipeline' as TourVariant}
        autoStart
        onTourControlReady={setTourControls}
      />
    </main>
  )
}
