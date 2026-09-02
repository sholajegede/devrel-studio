'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useUserContext } from '@/contexts/user-context'
import { Button } from '@/components/ui/button'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { AttentionLog } from '@/components/dashboard/analytics/attention-log'
import { BreakdownList, CountryChips } from '@/components/dashboard/analytics/breakdowns'
import { Label, Panel, StatTile, formatDuration, formatNumber } from '@/components/dashboard/analytics/primitives'
import { ViewsChart } from '@/components/dashboard/analytics/views-chart'

// ── Analytics ─────────────────────────────────────────────────────────────────
//
// Who has been looking at the DevRel's work — their clients' dashboards at
// [slug].devrel.studio and their public portfolio at /@handle.
//
// Views are counted in proxy.ts, which already sits in front of both surfaces.

const RANGES = [7, 14, 30, 90] as const

export default function AnalyticsPage() {
  const { profile } = useUserContext()
  const [days, setDays] = useState<number>(14)

  const ready = Boolean(profile?._id)
  const overview = useQuery(api.analytics.overview, ready ? { days } : 'skip')
  const activity = useQuery(api.analytics.recentActivity, ready ? { limit: 40 } : 'skip')
  const live = useQuery(api.analytics.liveNow, ready ? {} : 'skip')

  const loading = overview === undefined

  const totalViews = overview?.tiles.allTimeViews ?? 0

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">
      <RoleNotice />

      {/* Header — same shape as every other dashboard page: title, a one-line
          subtitle, actions on the right. */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : totalViews === 0
                ? 'Who opens your client dashboards and portfolio'
                : `${formatNumber(totalViews)} ${totalViews === 1 ? 'view' : 'views'} recorded`}
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((range) => (
            <Button
              key={range}
              type="button"
              size="sm"
              variant={days === range ? 'secondary' : 'ghost'}
              onClick={() => setDays(range)}
              aria-pressed={days === range}
              className="h-8 px-3 text-xs"
            >
              {range}d
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          {/* ── Recent ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              accent
              label="Views today"
              value={formatNumber(overview.tiles.viewsToday)}
              caption="Since midnight UTC"
              info="Pages opened today across all your client dashboards and your public portfolio. The day resets at midnight UTC, not in your local timezone, so the number doesn't jump when you travel."
            />
            <StatTile
              label="Visitors · 7d"
              value={formatNumber(overview.tiles.visitors7d)}
              caption="Unique people"
              info="Separate people who opened something in the last 7 days, not page loads — one person reading five pages counts once. Identified by a hash that changes daily, so someone returning tomorrow counts again."
            />
            <StatTile
              label="Manager opens · 7d"
              value={formatNumber(overview.tiles.managerViews7d)}
              caption="Signed in with an access code"
              info="Views by someone holding a valid access code for that client's dashboard — the manager you gave the code to. Everyone else is anonymous, including every portfolio visitor."
            />
            <StatTile
              label="Median read · 7d"
              value={formatDuration(overview.tiles.medianDwellMs)}
              caption="Time on page"
              info="The midpoint time spent on a page, counting only while the tab is actually visible. Views where the browser closed before reporting are left out rather than counted as zero."
            />
          </div>

          {/* ── All time ───────────────────────────────────────────────────── */}
          <div className="pt-2">
            <Label>
              All-time
              {overview.tiles.since
                ? ` · counting since ${new Date(overview.tiles.since).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`
                : ''}
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              accent
              label="Page views"
              value={formatNumber(overview.tiles.allTimeViews)}
              caption="All time"
              info="Every page opened across your client dashboards and portfolio since tracking began. Link previews from Slack, LinkedIn and search crawlers are filtered out — these are people."
            />
            <StatTile
              label="Visitors"
              value={formatNumber(overview.tiles.allTimeVisitors)}
              caption="Unique people, all time"
              info="Distinct visitors across the whole period. Because a visitor's identifier is rotated daily for privacy, the same person returning on several days is counted once per day."
            />
            <StatTile
              label="Busiest day"
              value={overview.tiles.peakDay ? formatNumber(overview.tiles.peakDay.views) : '—'}
              caption={
                overview.tiles.peakDay
                  ? `Views on ${new Date(overview.tiles.peakDay.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    })}`
                  : 'No views recorded yet'
              }
              info="The single day with the most views so far, and its date. Measured over all time rather than the range selected above, so changing the range doesn't reset it."
            />
            <StatTile
              label="Reports read"
              value={formatNumber(overview.tiles.reportsRead)}
              caption="Monthly reports opened"
              info="How many times a monthly report page has been opened on a client dashboard. Browsing the list of past reports doesn't count — only opening a report itself."
            />
          </div>

          <ViewsChart series={overview.series} days={overview.days} />

          {/* ── The attention log ──────────────────────────────────────────── */}
          <AttentionLog
            rows={activity ?? []}
            liveCount={live?.count ?? 0}
            liveCountries={live?.countries ?? []}
          />

          {/* ── Breakdowns ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BreakdownList
              title="Client dashboards · 7d"
              rows={overview.breakdowns.byClient}
              empty="No client dashboard was opened this week."
            />
            <BreakdownList
              title="Where they came from · 7d"
              rows={overview.breakdowns.byReferrer}
              empty="No visits this week."
            />
            <BreakdownList
              title="Portfolio pages · 7d"
              rows={overview.breakdowns.byPath}
              empty="Your portfolio had no visits this week."
            />
            <CountryChips rows={overview.breakdowns.byCountry} />
          </div>
        </div>
      )}
    </main>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Panel key={index}>
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-16 animate-pulse rounded bg-muted" />
          </Panel>
        ))}
      </div>
      <Panel className="h-[320px]">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </Panel>
    </div>
  )
}
