'use client'

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatDelta, type Delta } from '@/lib/metrics'

/**
 * Month-over-month change beside a headline number.
 *
 * Colour is intentionally not "up is green, down is red". A drop in views for a
 * month where less was published is not a failure, and painting it red invites
 * exactly the conversation the dashboard exists to avoid. Direction is carried
 * by the arrow; colour stays neutral apart from genuine growth.
 */
export function DeltaBadge({
  delta,
  label = 'vs last month',
}: {
  delta: Delta
  label?: string
}) {
  // Nothing this period and nothing last period — a badge would be noise.
  if (delta.current === 0 && delta.previous === 0) return null

  const Icon =
    delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : Minus

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs tabular-nums ${
        delta.direction === 'up' ? 'text-accent' : 'text-muted-foreground'
      }`}
      title={`${delta.current.toLocaleString()} this month · ${delta.previous.toLocaleString()} last month`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {formatDelta(delta)}
      <span className="sr-only"> {label}</span>
    </span>
  )
}
