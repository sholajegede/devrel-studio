'use client'

import { formatMonthLabel } from '@/lib/types'
import type { Delta } from '@/lib/metrics'

/**
 * What the most recent month added to a headline figure.
 *
 * This replaced a percentage badge sat inline beside the number, which was
 * wrong on two counts.
 *
 * It did not fit. At six columns the badge was clipped mid-word — "247,520
 * ↘ -100" with the percent sign cut off — because a long number and a badge
 * cannot share one line in a narrow card. Putting the change on its own line
 * removes the constraint entirely rather than tuning it.
 *
 * More seriously, it was not true. The headline is an all-time total; the delta
 * described one month against the one before. "247,520 downloads, -100%" reads
 * as the total having collapsed, when it means "nothing was published in that
 * category last month". A percentage of a lifetime total is not a meaningful
 * quantity, so this shows the absolute contribution instead — which is both
 * correct and the thing a client actually wants to know.
 */
export function MonthContribution({
  delta,
  month,
}: {
  delta: Delta
  /** `YYYY-MM` of the month being described. */
  month: string
}) {
  const label = formatMonthLabel(month).replace(/ \d{4}$/, '')

  // Nothing has ever been recorded for this metric — the whole card is a dash,
  // and a line explaining that nothing changed is noise.
  if (delta.current === 0 && delta.previous === 0) return null

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {delta.current > 0 ? (
        <>
          <span className="tabular-nums font-medium text-accent">
            +{delta.current.toLocaleString()}
          </span>{' '}
          in {label}
        </>
      ) : (
        <>none in {label}</>
      )}
    </p>
  )
}
