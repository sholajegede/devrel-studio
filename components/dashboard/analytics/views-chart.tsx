'use client'

import React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Label, Panel } from './primitives'

type Point = { date: string; views: number; visitors: number }

/**
 * Views over the window.
 *
 * Three deliberate choices, all from the reference design:
 *
 * A **halftone dot screen** rather than a flat or faded fill. At a constant dot
 * size the texture reads the same at any height, so a tall spike and a shallow
 * plateau are equally legible — a gradient washes out in exactly the region a
 * quiet week occupies.
 *
 * **Straight segments** rather than a smoothed curve. These are daily counts,
 * not a continuous signal: a spline invents values between the points and, on a
 * peak day, rounds off the very thing worth looking at.
 *
 * A **dot on the final point**, because the right-hand end is today and the eye
 * needs somewhere to land to read "where things stand now".
 */
export function ViewsChart({ series, days }: { series: Point[]; days: number }) {
  const max = Math.max(...series.map((point) => point.views), 1)

  // Ticks at the extremes and the two thirds between. Rounded to whole views —
  // a y-axis reading "3.5 views" is nonsense.
  const ticks = [0, Math.round(max / 3), Math.round((max * 2) / 3), max].filter(
    (value, index, all) => all.indexOf(value) === index,
  )

  const hasData = series.some((point) => point.views > 0)

  // A flat line across an empty 320px box is worse than no chart: it takes the
  // most space on the page to say nothing, and reads as something that failed
  // to load. Collapse to a single line until there is a shape worth drawing.
  if (!hasData) {
    return (
      <Panel>
        <Label>Page views · last {days} days</Label>
        <p className="mt-2 text-sm text-muted-foreground">
          No views yet — the chart appears once something has been opened.
        </p>
      </Panel>
    )
  }

  return (
    <Panel>
      <Label>Page views · last {days} days</Label>

      <div className="mt-6 h-[280px] w-full sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {/* userSpaceOnUse keeps the dot grid anchored to the chart rather
                  than to each shape, so the texture stays aligned as the area
                  changes height. */}
              <pattern id="viewsHalftone" width="4" height="4" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.85" fill="var(--accent)" opacity="0.6" />
              </pattern>
            </defs>

            <CartesianGrid
              horizontal
              vertical={false}
              stroke="var(--border)"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={(value: string) => {
                const date = new Date(value)
                return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`
              }}
              // Roughly five labels regardless of range: every third day over a
              // fortnight, every twelfth over a quarter.
              interval={Math.max(0, Math.ceil(series.length / 5) - 1)}
              minTickGap={12}
            />
            <YAxis
              width={48}
              ticks={ticks}
              domain={[0, max]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={(value: number) => value.toLocaleString()}
            />
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
              content={<ChartTooltip />}
            />
            <Area
              type="linear"
              dataKey="views"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#viewsHalftone)"
              // Recharts animates from zero on every data change; with a live
              // subscription behind this that means the whole curve replays
              // each time a view lands.
              isAnimationActive={false}
              dot={<LastPointDot lastIndex={series.length - 1} />}
              activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'none' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

/**
 * Marks only the final point — today.
 *
 * Recharts calls the `dot` renderer once per data point and expects an element
 * back every time, so the other days return an empty group rather than null.
 */
function LastPointDot(props: {
  lastIndex?: number
  index?: number
  cx?: number
  cy?: number
}) {
  const { lastIndex, index, cx, cy } = props
  if (index !== lastIndex || cx == null || cy == null) {
    return <g />
  }
  return <circle cx={cx} cy={cy} r={4} fill="var(--accent)" />
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { payload: Point }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  const heading = new Date(label ?? point.date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-popover-foreground">{heading}</div>
      <div className="mt-1 tabular-nums text-popover-foreground">
        {point.views.toLocaleString()} views
      </div>
      <div className="tabular-nums text-muted-foreground">
        {point.visitors.toLocaleString()} visitors
      </div>
    </div>
  )
}
