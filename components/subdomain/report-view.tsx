'use client'

import { useMemo, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import {
  buildReport,
  periodLabel,
  reachTrend,
  type ReportEntry,
} from '@/lib/report'
import { formatCompact, previousMonth } from '@/lib/metrics'
import { CATEGORY_META } from '@/lib/category-meta'
import { PlatformIcon } from '@/lib/platform-meta'
import { toast } from 'sonner'
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Share2,
} from 'lucide-react'

// ── The monthly report ────────────────────────────────────────────────────────
//
// Not the dashboard with a date filter. A dashboard is a tool you operate; a
// report is a document you read once and forward to your boss. That difference
// drives everything here: one column, a fixed period stated at the top, a
// narrative order (what happened → how it performed → what is next), and
// nothing interactive except the two things a reader genuinely wants — take it
// away as a PDF, or reply.

interface ReportData {
  client: { id: string; name: string; contact: string; website?: string; slug: string }
  period: string
  entries: ReportEntry[]
  feedback: {
    id: string
    rating?: number
    comment: string
    authorName?: string
    createdAt: string
  }[]
}

function Figure({
  label,
  value,
  previous,
  hint,
}: {
  label: string
  value: number
  previous?: number
  hint?: string
}) {
  const change =
    previous !== undefined && previous > 0
      ? Math.round(((value - previous) / previous) * 100)
      : null

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">
        {value > 0 ? formatCompact(value) : '—'}
      </p>
      {/* The hint describes the empty state. It must not appear beside a real
          number just because there was nothing to compare against — "In flight
          6" sat above "Nothing queued", which contradicted itself. */}
      {change !== null && value > 0 ? (
        <p
          className={`mt-1.5 inline-flex items-center gap-1 text-xs tabular-nums ${
            change >= 0 ? 'text-accent' : 'text-muted-foreground'
          }`}
        >
          {change >= 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {change >= 0 ? '+' : ''}
          {change}% on last period
        </p>
      ) : value === 0 && hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * Reach over six months.
 *
 * Hand-drawn bars rather than a charting library: the shape is four divs, and
 * recharts would ship a runtime, need a client boundary, and still need
 * overriding to match this palette. Every bar is labelled, so the chart is
 * readable without hovering — which also means it survives being printed.
 */
function TrendChart({ series }: { series: ReturnType<typeof reachTrend> }) {
  const peak = Math.max(...series.map((point) => point.reach), 1)

  return (
    <div className="flex items-end justify-between gap-3 sm:gap-5">
      {series.map((point) => {
        const height = Math.round((point.reach / peak) * 100)
        const isCurrent = point === series[series.length - 1]

        return (
          <div key={point.period} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span
              className={`text-[11px] tabular-nums ${
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
              }`}
            >
              {point.reach > 0 ? formatCompact(point.reach) : '—'}
            </span>

            <div className="flex h-32 w-full items-end">
              <div
                className={`w-full rounded-t transition-all ${
                  isCurrent ? 'bg-accent' : 'bg-muted-foreground/20'
                }`}
                // A month with output should never render as nothing at all,
                // so anything above zero keeps a visible floor.
                style={{ height: `${point.reach > 0 ? Math.max(height, 4) : 1}%` }}
              />
            </div>

            <span
              className={`text-[11px] ${
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
              }`}
            >
              {point.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function FeedbackForm({ slug, period }: { slug: string; period: string }) {
  const submit = useMutation(api.reports.submitFeedback)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/[0.04] p-5">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-medium text-foreground">Thank you — that has been sent.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It goes straight to the person who prepared this report.
          </p>
        </div>
      </div>
    )
  }

  const send = async () => {
    if (!comment.trim()) return
    setSending(true)
    try {
      await submit({
        slug,
        period,
        comment,
        rating: rating ?? undefined,
        authorName: name || undefined,
      })
      setSent(true)
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'data' in error && typeof error.data === 'string'
          ? error.data
          : 'Could not send that. Please try again.'
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-sm font-medium text-foreground">How was this period?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Anything you say here reaches the person who prepared the report. Optional, and only
        they can see it.
      </p>

      <div className="mt-5 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(rating === value ? null : value)}
            aria-label={`${value} out of 5`}
            aria-pressed={rating === value}
            className={`h-9 w-9 rounded-lg border text-sm tabular-nums transition-colors ${
              rating === value
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {value}
          </button>
        ))}
        <span className="ml-1 text-xs text-muted-foreground">
          {rating ? `${rating} of 5` : 'optional rating'}
        </span>
      </div>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="What landed well? What would you like more of next period?"
        className="mt-4 w-full resize-y rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-none"
      />

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="Your name (optional)"
          className="h-10 flex-1 rounded-lg border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !comment.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Send feedback
        </button>
      </div>
    </div>
  )
}

export function ReportView({ data }: { data: ReportData }) {
  const [downloading, setDownloading] = useState(false)

  const report = useMemo(() => buildReport(data.entries, data.period), [data])
  const trend = useMemo(() => reachTrend(data.entries, data.period, 6), [data])

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const response = await fetch('/api/export-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: data.client.name,
          period: report.label,
          content: report.published,
          stats: {
            published: report.totals.published,
            inProgress: report.upcoming.length,
            totalViews: report.totals.views,
            totalDownloads: report.totals.downloads,
            totalAttendees: report.totals.attendees,
            totalStars: report.totals.stars,
            totalReshares: report.totals.reshares,
          },
        }),
      })

      if (!response.ok) throw new Error('PDF generation failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${data.client.slug}-report-${data.period}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[report] pdf export failed:', error)
      toast.error('Could not build the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Masthead. A report states what it is and what it covers before anything
          else — the reader may have arrived from an email weeks later. */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Performance report
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
              {report.label}
            </h1>
            <p className="mt-3 text-[15px] text-muted-foreground">
              Prepared for {data.client.name}
            </p>
          </div>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download PDF
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        {/* Summary */}
        <section className="border-b border-border py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <Figure
              label="Published"
              value={report.totals.published}
              previous={report.previous.published}
              hint="Nothing shipped this period"
            />
            <Figure
              label="Total reach"
              value={report.reach}
              previous={report.previousReach}
              hint="No reach recorded yet"
            />
            <Figure label="Reshares" value={report.reshareCount} hint="Not amplified" />
            <Figure label="In flight" value={report.upcoming.length} hint="Nothing queued" />
          </div>

          {report.published.length > 0 && (
            <p className="mt-10 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {report.totals.published}{' '}
              {report.totals.published === 1 ? 'piece was' : 'pieces were'} published in{' '}
              {report.label} across {report.platforms.length}{' '}
              {report.platforms.length === 1 ? 'platform' : 'platforms'}
              {/* Zero reach almost always means the numbers have not been
                  collected yet, not that nobody saw the work. Saying "reaching
                  0 people" turns a gap in the data into an accusation. */}
              {report.reach > 0 ? (
                <>
                  , reaching{' '}
                  <span className="font-medium text-foreground">
                    {report.reach.toLocaleString()}
                  </span>{' '}
                  {report.reach === 1 ? 'person' : 'people'}.
                </>
              ) : (
                <>. Performance figures for this period have not been recorded yet.</>
              )}
            </p>
          )}
        </section>

        {/* Trend */}
        <section className="border-b border-border py-12">
          <h2 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Reach over six months
          </h2>
          <div className="mt-8">
            <TrendChart series={trend} />
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Views, attendees and downloads combined. GitHub stars are excluded — a star is an
            endorsement from someone already there, not a person reached.
          </p>
        </section>

        {/* Category split */}
        {report.byCategory.length > 0 && (
          <section className="border-b border-border py-12">
            <h2 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              What was delivered
            </h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              {report.byCategory.map((row, i) => {
                const Icon = CATEGORY_META[row.category].icon
                return (
                  <div
                    key={row.category}
                    className={`flex items-center gap-4 px-5 py-3.5 ${
                      i > 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm text-foreground">{row.label}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {row.count} {row.count === 1 ? 'piece' : 'pieces'}
                    </span>
                    <span className="w-24 text-right text-sm tabular-nums text-foreground">
                      {row.metric > 0 ? formatCompact(row.metric) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Everything published */}
        <section className="border-b border-border py-12">
          <h2 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Published in {report.label}
          </h2>

          {report.published.length === 0 ? (
            <p className="mt-6 text-[15px] text-muted-foreground">
              Nothing was published in this period.
            </p>
          ) : (
            <ol className="mt-6 space-y-px overflow-hidden rounded-xl border border-border bg-border">
              {report.published.map((item) => {
                const category = CATEGORY_META[
                  (item.category as keyof typeof CATEGORY_META) ?? 'Written'
                ] ?? CATEGORY_META.Written
                const Icon = category.icon

                const metric =
                  item.views || item.attendees || item.downloads || item.stars || 0

                return (
                  <li key={item.id ?? item.title} className="bg-background p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug text-foreground">
                          {item.title}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="h-3 w-3" />
                            {item.category ?? 'Written'}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <PlatformIcon platform={item.platform} size={12} />
                            {item.platform}
                          </span>
                          <span>
                            {new Date(item.publicationDate).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          {(item.reshares?.length ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Share2 className="h-3 w-3" />
                              {item.reshares!.length} reshares
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {metric > 0 && (
                          <p className="text-lg font-semibold tabular-nums text-foreground">
                            {formatCompact(metric)}
                          </p>
                        )}
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* What's next */}
        {report.upcoming.length > 0 && (
          <section className="border-b border-border py-12">
            <h2 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              In flight
            </h2>
            <ul className="mt-6 space-y-2.5">
              {report.upcoming.slice(0, 8).map((item) => (
                <li
                  key={item.id ?? item.title}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.status} ·{' '}
                    {new Date(item.publicationDate).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Feedback */}
        <section className="py-12">
          <h2 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Your response
          </h2>

          {data.feedback.length > 0 && (
            <ul className="mb-6 mt-6 space-y-3">
              {data.feedback.map((item) => (
                <li key={item.id} className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm leading-relaxed text-foreground">{item.comment}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.authorName ?? 'Anonymous'}
                    {item.rating ? ` · rated ${item.rating}/5` : ''} ·{' '}
                    {new Date(item.createdAt).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <FeedbackForm slug={data.client.slug} period={data.period} />
          </div>
        </section>

        <footer className="border-t border-border pt-8 text-xs text-muted-foreground">
          <p>
            {report.label} · {data.client.name} · Covering{' '}
            {periodLabel(previousMonth(data.period))} to {report.label} for comparison.
          </p>
          <p className="mt-1">Prepared with devrel.studio</p>
        </footer>
      </main>
    </div>
  )
}
