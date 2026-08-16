import { AlertTriangle, TrendingUp } from 'lucide-react'
import { ContentEntry } from '@/lib/types'
import { categoryOf, getMetricLabel, getMetricValue } from '@/lib/metrics'
import { categoryMetricIcon } from '@/lib/category-meta'

/** "3 days ago" — coarse on purpose, this is a freshness hint not a timestamp. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const minutes = Math.round((Date.now() - then) / 60_000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

/**
 * The metric line under a content row — "12,400 views", "480 stars".
 * Renders nothing when the entry has no number yet, and appends the weekly
 * trend for packages.
 *
 * Package and Demo numbers are refreshed automatically from npm and GitHub, so
 * they also carry when they were last synced — and a warning when that failed,
 * since a stale number that looks live is worse than an obviously stale one.
 */
export function EntryMetric({ entry }: { entry: ContentEntry }) {
  const value = getMetricValue(entry)
  const category = categoryOf(entry)
  const isAutoSynced = category === 'Package' || category === 'Demo'

  if (value === 0 && !(isAutoSynced && entry.statsSyncError)) return null

  const Icon = categoryMetricIcon(category)

  return (
    <span className="flex items-center gap-1">
      {value > 0 && (
        <>
          <Icon className="h-3 w-3" />
          {value.toLocaleString()} {getMetricLabel(category).toLowerCase()}
        </>
      )}
      {category === 'Package' && (entry.weeklyDownloads ?? 0) > 0 && (
        <span className="text-muted-foreground/70 flex items-center gap-0.5 ml-0.5">
          · <TrendingUp className="h-2.5 w-2.5" /> {entry.weeklyDownloads!.toLocaleString()}/wk
        </span>
      )}
      {isAutoSynced && entry.statsSyncError ? (
        <span
          className="text-amber-600 flex items-center gap-0.5 ml-0.5"
          title={`Last sync failed: ${entry.statsSyncError}`}
        >
          <AlertTriangle className="h-2.5 w-2.5" /> sync failed
        </span>
      ) : (
        isAutoSynced &&
        entry.statsSyncedAt && (
          <span
            className="text-muted-foreground/60 ml-0.5"
            title={`Synced from ${category === 'Package' ? 'npm' : 'GitHub'} on ${new Date(
              entry.statsSyncedAt
            ).toLocaleString()}`}
          >
            · synced {relativeTime(entry.statsSyncedAt)}
          </span>
        )
      )}
    </span>
  )
}
