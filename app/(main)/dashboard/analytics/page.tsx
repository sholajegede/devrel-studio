'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useUserContext } from '@/contexts/user-context'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { Panel, formatDuration, formatNumber } from '@/components/dashboard/analytics/primitives'
import {
  DevicesPanel,
  MetricGrid,
  PagesTable,
  RankedList,
  RecentSessions,
  TrafficChart,
  countryName,
  formatCountry,
} from '@/components/dashboard/analytics/overview-parts'

// ── Analytics ─────────────────────────────────────────────────────────────────
//
// Who has been looking at the DevRel's work: their clients' dashboards at
// [slug].devrel.studio and their public portfolio at /@handle. Views are
// counted in proxy.ts, which sits in front of both surfaces.

const RANGES = [
  { days: 1, label: '24h' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
] as const

export default function AnalyticsPage() {
  const { profile } = useUserContext()
  const [days, setDays] = useState<number>(7)
  const [sessionLimit, setSessionLimit] = useState(20)

  const ready = Boolean(profile?._id)
  const overview = useQuery(api.analytics.overview, ready ? { days } : 'skip')
  const sessions = useQuery(api.analytics.recentSessions, ready ? { limit: sessionLimit } : 'skip')
  const live = useQuery(api.analytics.liveNow, ready ? {} : 'skip')

  // Null while the socket has no verified identity yet: wait, do not render.
  const loading = overview == null
  const rangeLabel = days <= 1 ? 'last 24 hours' : `last ${days} days`
  const liveCount = live?.count ?? 0

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">
      <RoleNotice />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Who opens your client dashboards and portfolio, and what they read. Visitors are
          anonymous unless they sign in with an access code.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              liveCount > 0 ? 'animate-pulse bg-accent' : 'bg-muted-foreground/40'
            }`}
          />
          <span className="font-semibold tabular-nums text-foreground">{liveCount}</span>
          <span className="text-muted-foreground">reading now</span>
        </div>

        <div className="inline-flex rounded-full border bg-card p-1" role="radiogroup" aria-label="Range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              role="radio"
              aria-checked={days === range.days}
              onClick={() => setDays(range.days)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                days === range.days
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          <MetricGrid
            metrics={[
              {
                label: 'Visitors',
                value: formatNumber(overview.tiles.visitors),
                accent: true,
                info: `Separate people in the ${rangeLabel}. Identified by a hash that changes daily, so someone returning tomorrow counts again.`,
              },
              {
                label: 'Page views',
                value: formatNumber(overview.tiles.views),
                info: 'Pages opened across your client dashboards and portfolio. Link previews and crawlers are filtered out.',
              },
              {
                label: 'Sessions',
                value: formatNumber(overview.tiles.sessions),
                info: 'Visits. A visit ends after 30 minutes without a new page view.',
              },
              {
                label: 'Avg. session',
                value: formatDuration(overview.tiles.avgSessionMs),
                info: 'Average time per visit, counted only while the tab is visible. Visits that reported no time are left out.',
              },
              {
                label: 'Bounce rate',
                value:
                  overview.tiles.bounceRate == null
                    ? '—'
                    : `${Math.round(overview.tiles.bounceRate * 100)}%`,
                info: 'Share of visits that opened one page and left.',
              },
              {
                label: 'Manager opens',
                value: formatNumber(overview.tiles.managerViews),
                info: 'Views by someone holding a valid access code for that client: the manager you gave the code to.',
              },
              {
                label: 'Reports read',
                value: formatNumber(overview.tiles.reportsRead),
                info: 'Monthly report pages opened on your client dashboards, all time. Browsing the list of past reports does not count.',
              },
              {
                label: 'Median read',
                value: formatDuration(overview.tiles.medianDwellMs),
                info: 'The midpoint time spent on a page in this range.',
              },
            ]}
          />

          <TrafficChart series={overview.series ?? []} days={overview.days} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PagesTable rows={overview.pages ?? []} className="lg:col-span-2" />
            <RankedList
              title="Client dashboards"
              note="Views by client"
              rows={overview.breakdowns.byClientName ?? []}
              empty="No client dashboard was opened in this range."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RankedList
              title="Sources"
              rows={overview.breakdowns.byReferrer ?? []}
              empty="No visits in this range."
              format={(label) => (label === 'direct' ? 'Direct' : label)}
            />
            <RankedList
              title="Entry pages"
              note="Where visits start"
              rows={overview.breakdowns.byEntry ?? []}
              empty="No visits in this range."
              format={(label) => <span className="font-mono text-xs">{label}</span>}
            />
            <RankedList
              title="Campaigns"
              note="From utm_source or ref links"
              rows={overview.breakdowns.byCampaign ?? []}
              empty="No tagged links opened yet. Add ?ref=linkedin to a link you share."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RankedList
              title="Countries"
              rows={overview.breakdowns.byCountry ?? []}
              empty="No visits in this range."
              format={formatCountry}
            />
            <RankedList
              title="Cities"
              rows={overview.breakdowns.byCity ?? []}
              empty="Recorded for visits from 29 Sep 2026 onward."
              format={(label) => {
                const [city, code] = label.split(', ')
                return code ? `${city}, ${countryName(code)}` : city
              }}
            />
            <DevicesPanel
              devices={overview.breakdowns.byDevice ?? []}
              browsers={overview.breakdowns.byBrowser ?? []}
              systems={overview.breakdowns.byOs ?? []}
            />
          </div>

          <RecentSessions
            rows={sessions ?? []}
            canLoadMore={(sessions?.length ?? 0) >= sessionLimit && sessionLimit < 100}
            onLoadMore={() => setSessionLimit((limit) => Math.min(limit + 20, 100))}
          />

          <p className="text-xs text-muted-foreground">
            {formatNumber(overview.tiles.allTimeViews)} views and{' '}
            {formatNumber(overview.tiles.allTimeVisitors)} visitors recorded
            {overview.tiles.since
              ? ` since ${new Date(overview.tiles.since).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`
              : ''}
            {overview.tiles.peakDay
              ? `. Busiest day: ${formatNumber(overview.tiles.peakDay.views)} views on ${new Date(
                  overview.tiles.peakDay.date,
                ).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}.`
              : '.'}{' '}
            Updates in real time.
          </p>
        </div>
      )}
    </main>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Panel className="h-[168px]">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </Panel>
      <Panel className="h-[320px]">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </Panel>
    </div>
  )
}
