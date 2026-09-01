import React from 'react'
import { Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// ── The section's visual vocabulary ───────────────────────────────────────────
//
// Four pieces, reused everywhere: a card, a section label, a stat tile and a
// bar row.
//
// These were originally a self-contained dark "instrument panel" in monospace,
// modelled on the reference design. That was the wrong call: a section that
// keeps its own background, typeface and palette reads as a foreign page pasted
// into the dashboard, and it ignored the theme toggle entirely. Everything here
// now uses the platform's own card, type and accent, so Analytics looks like the
// rest of the product and follows light and dark with it.

export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <Card className={`gap-0 p-5 ${className}`}>{children}</Card>
}

/** Small, muted section heading. Sentence case, matching the rest of the app. */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium text-muted-foreground">{children}</div>
  )
}

/**
 * An explainer attached to a heading.
 *
 * A stat tile has room for a label and a caption, and neither can say what is
 * actually being counted — whether a "visitor" is a person or a page load,
 * whether "today" is local or UTC, what does and does not qualify as a read.
 * Guessing wrong about a number is worse than not having it, so every tile
 * carries the exact definition one hover or tap away.
 *
 * The trigger is a real button, so it is reachable by keyboard and opens on
 * focus as well as hover — a plain icon would be invisible to both.
 */
export function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">What this counts</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * One headline figure.
 *
 * `accent` is reserved for the single most important tile in a row — colour
 * used on every tile would rank nothing. Figures are tabular-nums so a column
 * of them stays aligned as the numbers change.
 */
export function StatTile({
  label,
  value,
  caption,
  info,
  accent = false,
}: {
  label: string
  value: string
  caption: string
  /** What the number counts, exactly. Shown on the info icon. */
  info?: React.ReactNode
  accent?: boolean
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {info && <InfoHint>{info}</InfoHint>}
      </div>
      <div
        className={`mt-2 text-3xl leading-none font-semibold tabular-nums ${
          accent ? 'text-accent' : 'text-foreground'
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{caption}</div>
    </Panel>
  )
}

/**
 * A labelled row with a proportional bar.
 *
 * The bar is scaled against the largest value in its own list rather than
 * against a global maximum, so a list where everything is small still shows its
 * shape instead of collapsing into a row of stubs.
 */
export function BarRow({
  label,
  value,
  max,
  hint,
}: {
  label: string
  value: number
  max: number
  hint?: string
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-[38%] shrink-0 truncate text-sm" title={hint ?? label}>
        {label}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
          {value.toLocaleString()}
        </div>
      </div>
    </div>
  )
}

/** Shown in place of a list that has nothing in it yet. */
export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-sm text-muted-foreground">{children}</div>
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatNumber(value: number): string {
  return value.toLocaleString()
}

/** Compact durations: 42s, 6m 40s. Hours never appear — see recordDuration. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}

/**
 * Relative time, coarsening as it ages.
 *
 * "26s ago" matters for something happening now; "3d ago" is enough for
 * something that is not. Precision past the point of usefulness just makes a
 * feed harder to scan.
 */
export function formatRelative(at: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * ISO-3166 alpha-2 to its flag emoji.
 *
 * The letters map onto the regional-indicator block at a fixed offset, so this
 * needs no lookup table and covers every country the CDN can report.
 */
export function countryFlag(code: string | undefined): string {
  if (!code || code.length !== 2) return '🌐'
  const base = 0x1f1e6
  const upper = code.toUpperCase()
  return String.fromCodePoint(
    base + (upper.charCodeAt(0) - 65),
    base + (upper.charCodeAt(1) - 65),
  )
}
