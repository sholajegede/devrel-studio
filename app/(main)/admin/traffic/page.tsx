'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ViewsChart } from '@/components/dashboard/analytics/views-chart'
import {
  BarRow,
  EmptyRow,
  Label,
  Panel,
  StatTile,
  countryFlag,
  formatNumber,
} from '@/components/dashboard/analytics/primitives'

// ── Traffic to devrel.studio itself ───────────────────────────────────────────
//
// The counting hook has been in the proxy since the analytics work, seeing every
// request and recording only client dashboards and portfolios. This is the same
// table, the same visitor hashing and the same bot rules, pointed at the
// product's own pages.
//
// It reuses the DevRel-facing chart and rows rather than introducing a second
// chart language for the console: one halftone area, one accent hue, bars in the
// same shape. A support tool that draws its numbers differently from the product
// makes somebody compare two pictures and reach for a third.

const RANGES = [7, 30, 90]

/** 'all' is every page on every host: the product, portfolios and client dashboards. */
const SURFACES = [
  { id: 'all', label: 'All pages' },
  { id: 'site', label: 'devrel.studio' },
  { id: 'portfolio', label: 'Portfolios' },
  { id: 'dashboard', label: 'Client dashboards' },
] as const

type Surface = (typeof SURFACES)[number]['id']

export default function AdminTrafficPage() {
  const [days, setDays] = useState(30)
  const [surface, setSurface] = useState<Surface>('all')
  const traffic = useQuery(api.adminInsights.traffic, { days, surface })
  const signups = useQuery(api.adminInsights.signups, { days })

  const loading = traffic === undefined

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Traffic</h1>
          <p className="text-sm text-muted-foreground">
            Every page on the platform: devrel.studio itself, every portfolio and
            every client dashboard. Filter to one surface below.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {SURFACES.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={surface === option.id ? 'secondary' : 'ghost'}
              onClick={() => setSurface(option.id)}
              aria-pressed={surface === option.id}
              className="h-8 px-3 text-xs"
            >
              {option.label}
            </Button>
          ))}
          <span aria-hidden className="mx-1 w-px self-stretch bg-border" />
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="gap-0 p-5">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-7 w-14 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Page views"
              value={formatNumber(traffic.views)}
              caption={`Last ${days} days`}
            />
            <StatTile
              label="Visitors"
              value={formatNumber(traffic.visitors)}
              caption="Distinct per day"
              info="A visitor is one IP and user agent on one day. The hash rotates daily, so the same person tomorrow counts again — which is the honest reading of an identifier that deliberately does not persist."
            />
            <StatTile
              label="New accounts"
              value={signups === undefined ? '—' : formatNumber(signups.inPeriod)}
              caption={
                signups === undefined ? 'Loading…' : `${formatNumber(signups.total)} in total`
              }
              accent
            />
            <StatTile
              label="devrel.studio"
              value={formatNumber(traffic.bySurface.site)}
              caption={`${formatNumber(traffic.bySurface.portfolio)} portfolio · ${formatNumber(
                traffic.bySurface.dashboard,
              )} dashboard views`}
            />
          </div>

          <div className="mt-4">
            <ViewsChart
              days={days}
              series={traffic.series.map((point) => ({
                date: point.day,
                views: point.views,
                visitors: point.visitors,
              }))}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel>
                <Label>Pages</Label>
                {/* Routes, not URLs. The proxy replaces anything that looks like
                    an identifier with its parameter name before the row is
                    written, so /dashboard/edit/:id is one line rather than one
                    line per entry anybody has ever edited. */}
                <div className="mt-4 space-y-2.5">
                  {traffic.routes.length === 0 ? (
                    <EmptyRow>Nothing has been opened yet.</EmptyRow>
                  ) : (
                    traffic.routes.map((route) => (
                      <BarRow
                        key={route.path}
                        label={route.path}
                        value={route.views}
                        max={traffic.routes[0].views}
                        hint={`${route.path} · ${formatNumber(route.visitors)} ${
                          route.visitors === 1 ? 'visitor' : 'visitors'
                        }`}
                      />
                    ))
                  )}
                </div>
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel>
                <Label>Where from</Label>
                <div className="mt-4 space-y-2.5">
                  {traffic.referrers.length === 0 ? (
                    <EmptyRow>
                      Nothing arrived with a referrer — direct visits and links from
                      apps that strip it.
                    </EmptyRow>
                  ) : (
                    traffic.referrers.map((referrer) => (
                      <BarRow
                        key={referrer.host}
                        label={referrer.host}
                        value={referrer.count}
                        max={traffic.referrers[0].count}
                      />
                    ))
                  )}
                </div>
              </Panel>

              <Panel>
                <Label>Where</Label>
                <div className="mt-4 space-y-2.5">
                  {traffic.countries.length === 0 ? (
                    <EmptyRow>No countries recorded yet.</EmptyRow>
                  ) : (
                    traffic.countries.map((country) => (
                      <BarRow
                        key={country.code}
                        label={`${countryFlag(country.code)} ${country.code}`}
                        value={country.count}
                        max={traffic.countries[0].count}
                      />
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  )
}
