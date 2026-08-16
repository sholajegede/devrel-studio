import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  CATEGORY_METRIC,
  CATEGORY_PDF_COLOR,
  aggregate,
  aggregateByCategory,
  categoryOf,
  formatCompact,
  getMetricValue,
} from '@/lib/metrics'
import { CATEGORIES } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportContentItem {
  _id?: string
  category?: string
  title: string
  platform: string
  publicationDate: string
  status: string
  contentType?: string
  views?: number
  downloads?: number
  weeklyDownloads?: number
  attendees?: number
  eventName?: string
  eventLocation?: string
  podcastName?: string
  packageName?: string
  repoUrl?: string
  stack?: string
  stars?: number
  reshares?: { platform: string; link: string; date: string }[]
}

export interface ReportData {
  client: string
  content: ReportContentItem[]
  stats: {
    published: number
    inProgress: number
    totalViews: number
    totalDownloads: number
    totalAttendees: number
    totalStars?: number
    totalReshares: number
  }
  period: string
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  white:        '#ffffff',
  fg:           '#0f172a',
  muted:        '#64748b',
  accent:       '#0d9488',
  border:       '#e2e8f0',
  cardBg:       '#f8fafc',
  mutedBg:      '#f1f5f9',
  rowAlt:       '#fafbfc',
  // status
  pubBg:        '#f0fdf9', pubFg:  '#0d9488',
  draftBg:      '#f8fafc', draftFg: '#64748b',
  reviewBg:     '#fffbeb', reviewFg: '#b45309',
  scheduledBg:  '#f1f5f9', scheduledFg: '#475569',
  // category
  written:  '#1d4ed8',
  video:    '#dc2626',
  event:    '#7c3aed',
  podcast:  '#ea580c',
  package:  '#059669',
  demo:     '#0f766e',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.fg,
    paddingHorizontal: 48,
    paddingTop: 36,
    paddingBottom: 56,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 28,
  },
  brandRow: { flexDirection: 'row', alignItems: 'baseline' },
  brandMain: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: C.fg },
  brandDot:  { fontFamily: 'Helvetica-Bold', fontSize: 15, color: C.muted },
  headerRight: { alignItems: 'flex-end' },
  headerLabel: { fontSize: 7, color: C.muted, letterSpacing: 0.5 },
  headerDate:  { fontSize: 8, color: C.muted, marginTop: 2 },

  // Hero
  hero: { marginBottom: 28 },
  heroClient:   { fontFamily: 'Helvetica-Bold', fontSize: 24, color: C.fg, marginBottom: 4 },
  heroSubtitle: { fontSize: 10, color: C.muted, marginBottom: 3 },
  heroPeriod:   { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.accent },

  // Section label
  sectionLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 14,
  },

  // Stat cards — 3-up grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 28 },
  statCard: {
    width: '31%',
    marginRight: '3.5%',
    marginBottom: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statLabel: { fontSize: 7.5, color: C.muted, marginBottom: 6 },
  statValue: { fontFamily: 'Helvetica-Bold', fontSize: 20, color: C.fg },

  // Category breakdown
  breakdownSection: { marginBottom: 28 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  breakdownDot:  { width: 7, height: 7, borderRadius: 3.5, marginRight: 8 },
  breakdownName: { fontSize: 9, color: C.fg, width: 58 },
  breakdownBar:  { height: 5, borderRadius: 2.5, marginRight: 10 },
  breakdownMeta: { fontSize: 8, color: C.muted, flex: 1 },

  // Month overview table
  overviewSection: { marginBottom: 0 },

  // Generic table
  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    marginBottom: 24,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.mutedBg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  tableHeadCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  tableRowAlt:  { backgroundColor: C.rowAlt },
  tableRowLast: { borderBottomWidth: 0 },
  cellText:     { fontSize: 8.5, color: C.fg, lineHeight: 1.4 },
  cellMuted:    { fontSize: 7.5, color: C.muted, marginTop: 2, lineHeight: 1.4 },
  cellAccent:   { fontSize: 7.5, color: C.accent, marginTop: 2 },

  // Status badge
  badge: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },

  // Month section header (detail page)
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 8,
    marginBottom: 10,
    marginTop: 20,
  },
  monthTitle: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.fg },
  monthMetaRow: { flexDirection: 'row' },
  monthMeta:  { fontSize: 7.5, color: C.muted, marginLeft: 12 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 7,
  },
  footerText: { fontSize: 7, color: C.muted },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtNum = formatCompact

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Short metric label per category, e.g. "12.4K views", "480 stars". */
const METRIC_SUFFIX: Record<string, string> = {
  views: 'views', downloads: 'dl.', attendees: 'att.', stars: 'stars',
}

function getMetric(item: ReportContentItem): string {
  // Packages prefer the weekly trend when there is one.
  if (categoryOf(item) === 'Package' && (item.weeklyDownloads ?? 0) > 0) {
    return `${fmtNum(item.weeklyDownloads!)}/wk`
  }

  const value = getMetricValue(item)
  if (value === 0) return '—'

  const { key } = CATEGORY_METRIC[categoryOf(item)]
  return `${fmtNum(value)} ${METRIC_SUFFIX[key]}`
}

const CAT_COLOR = CATEGORY_PDF_COLOR

const STATUS_CFG: Record<string, { bg: string; fg: string; label: string }> = {
  'Published':        { bg: C.pubBg,       fg: C.pubFg,      label: 'Published' },
  'Draft':            { bg: C.draftBg,     fg: C.draftFg,    label: 'Draft' },
  'Waiting Approval': { bg: C.reviewBg,    fg: C.reviewFg,   label: 'In Review' },
  'Scheduled':        { bg: C.scheduledBg, fg: C.scheduledFg, label: 'Scheduled' },
}

const STATUS_ORDER: Record<string, number> = { Published: 0, 'Waiting Approval': 1, Draft: 2, Scheduled: 3 }

// Table column widths (sum = 516 — usable width at 48px margins)
const COL = { title: 190, category: 52, platform: 75, status: 62, metric: 68, date: 69 }

// ── Shared page elements ──────────────────────────────────────────────────────

function Header() {
  return (
    <View style={s.header} fixed>
      <View style={s.brandRow}>
        <Text style={s.brandMain}>devrel</Text>
        <Text style={s.brandDot}>.studio</Text>
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerLabel}>PERFORMANCE REPORT</Text>
        <Text style={s.headerDate}>
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>
    </View>
  )
}

function Footer({ client }: { client: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>devrel.studio · {client} Performance Report</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { bg: C.draftBg, fg: C.muted, label: status }
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function createReportDocument(data: ReportData) {
  const { client, content, stats, period } = data
  const clientName = client.charAt(0).toUpperCase() + client.slice(1)

  // Group by month
  const byMonth: Record<string, ReportContentItem[]> = {}
  const monthOrder: Record<string, number> = {}
  for (const item of content) {
    const date = new Date(item.publicationDate)
    const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(item)
    monthOrder[key] = date.getFullYear() * 12 + date.getMonth()
  }
  // Newest month first, sorted on a real ordinal rather than by re-parsing the
  // localized label.
  const sortedMonths = Object.entries(byMonth).sort(
    ([a], [b]) => monthOrder[b] - monthOrder[a]
  )

  // Category aggregates
  const byCategory = aggregateByCategory(content)
  const total = content.length || 1

  return (
    <Document>
      {/* ──────────────────────────────── Page 1 — Summary ─────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Header />

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroClient}>{clientName}</Text>
          <Text style={s.heroSubtitle}>Content Performance Report</Text>
          <Text style={s.heroPeriod}>{period}</Text>
        </View>

        {/* Activity summary */}
        <Text style={s.sectionLabel}>ACTIVITY SUMMARY</Text>
        <View style={s.divider} />
        <View style={s.statsGrid}>
          {[
            { label: 'Published',   value: String(stats.published) },
            { label: 'In Progress', value: String(stats.inProgress) },
            { label: 'Total Views', value: stats.totalViews     > 0 ? fmtNum(stats.totalViews)     : '—' },
            { label: 'Downloads',   value: stats.totalDownloads > 0 ? fmtNum(stats.totalDownloads) : '—' },
            { label: 'Attendees',   value: stats.totalAttendees > 0 ? fmtNum(stats.totalAttendees) : '—' },
            ...((stats.totalStars ?? 0) > 0
              ? [{ label: 'Stars', value: fmtNum(stats.totalStars!) }]
              : []),
            { label: 'Reshares',    value: stats.totalReshares  > 0 ? String(stats.totalReshares)  : '—' },
          ].map((stat, i) => (
            <View key={stat.label} style={[s.statCard, i % 3 === 2 ? { marginRight: 0 } : {}]}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={s.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Content breakdown */}
        <Text style={s.sectionLabel}>CONTENT BREAKDOWN</Text>
        <View style={s.divider} />
        <View style={s.breakdownSection}>
          {CATEGORIES.filter(cat => byCategory[cat].count > 0).map(cat => {
            const totals = byCategory[cat]
            const count  = totals.count
            const pct    = count / total
            const color  = CAT_COLOR[cat] ?? C.muted

            // Each category reports only the metric it owns.
            const { key, label } = CATEGORY_METRIC[cat]
            const parts = [`${count} ${count === 1 ? 'item' : 'items'}`]
            if (totals[key] > 0) parts.push(`${fmtNum(totals[key])} ${label.toLowerCase()}`)

            return (
              <View key={cat} style={s.breakdownRow}>
                <View style={[s.breakdownDot, { backgroundColor: color }]} />
                <Text style={s.breakdownName}>{cat}</Text>
                <View style={[s.breakdownBar, { backgroundColor: color, width: `${Math.max(pct * 45, 2)}%` }]} />
                <Text style={s.breakdownMeta}>{parts.join(' · ')}</Text>
              </View>
            )
          })}
        </View>

        {/* Monthly overview table — only when multiple months */}
        {sortedMonths.length > 1 && (
          <View style={s.overviewSection}>
            <Text style={s.sectionLabel}>MONTHLY OVERVIEW</Text>
            <View style={s.divider} />
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.tableHeadCell, { flex: 3 }]}>MONTH</Text>
                <Text style={[s.tableHeadCell, { flex: 1 }]}>TOTAL</Text>
                <Text style={[s.tableHeadCell, { flex: 1 }]}>PUBLISHED</Text>
                <Text style={[s.tableHeadCell, { flex: 1 }]}>VIEWS</Text>
                <Text style={[s.tableHeadCell, { flex: 1 }]}>DL/ATT/STARS</Text>
                <Text style={[s.tableHeadCell, { flex: 1 }]}>RESHARES</Text>
              </View>
              {sortedMonths.map(([month, items], idx) => {
                const m = aggregate(items)
                const isLast = idx === sortedMonths.length - 1
                return (
                  <View key={month} style={[s.tableRow, idx % 2 !== 0 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                    <Text style={[s.cellText, { flex: 3 }]}>{month}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{items.length}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{m.published}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{m.views > 0 ? fmtNum(m.views) : '—'}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{m.downloads > 0 ? fmtNum(m.downloads) : m.attendees > 0 ? fmtNum(m.attendees) : m.stars > 0 ? fmtNum(m.stars) : '—'}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{m.reshares > 0 ? String(m.reshares) : '—'}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <Footer client={clientName} />
      </Page>

      {/* ──────────────────────────────── Page 2+ — Detail ─────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Header />
        <Text style={[s.sectionLabel, { marginBottom: 4 }]}>CONTENT DETAIL</Text>
        <View style={s.divider} />

        {sortedMonths.map(([month, items]) => {
          const m = aggregate(items)
          const sorted = [...items].sort((a, b) => (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4))

          return (
            <View key={month}>
              {/* Month header */}
              <View style={s.monthHeader}>
                <Text style={s.monthTitle}>{month}</Text>
                <View style={s.monthMetaRow}>
                  <Text style={s.monthMeta}>{m.published} of {items.length} published</Text>
                  {m.views     > 0 && <Text style={s.monthMeta}>{fmtNum(m.views)} views</Text>}
                  {m.attendees > 0 && <Text style={s.monthMeta}>{fmtNum(m.attendees)} attendees</Text>}
                  {m.downloads > 0 && <Text style={s.monthMeta}>{fmtNum(m.downloads)} downloads</Text>}
                  {m.stars     > 0 && <Text style={s.monthMeta}>{fmtNum(m.stars)} stars</Text>}
                  {m.reshares  > 0 && <Text style={s.monthMeta}>{m.reshares} reshares</Text>}
                </View>
              </View>

              {/* Content table */}
              <View style={s.table}>
                <View style={s.tableHead}>
                  <Text style={[s.tableHeadCell, { width: COL.title }]}>TITLE</Text>
                  <Text style={[s.tableHeadCell, { width: COL.category }]}>TYPE</Text>
                  <Text style={[s.tableHeadCell, { width: COL.platform }]}>PLATFORM</Text>
                  <Text style={[s.tableHeadCell, { width: COL.status }]}>STATUS</Text>
                  <Text style={[s.tableHeadCell, { width: COL.metric }]}>METRIC</Text>
                  <Text style={[s.tableHeadCell, { width: COL.date }]}>DATE</Text>
                </View>
                {sorted.map((item, idx) => {
                  const cat     = categoryOf(item)
                  const catColor = CAT_COLOR[cat] ?? C.muted
                  const reshares = item.reshares?.length ?? 0
                  const isLast   = idx === sorted.length - 1
                  return (
                    <View key={item._id ?? `${month}-${idx}`} style={[s.tableRow, idx % 2 !== 0 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                      {/* Title column */}
                      <View style={{ width: COL.title }}>
                        <Text style={s.cellText} >{item.title}</Text>
                        {item.category === 'Event'   && item.eventName   && <Text style={s.cellMuted}>{item.eventName}{item.eventLocation ? ` · ${item.eventLocation}` : ''}</Text>}
                        {item.category === 'Podcast' && item.podcastName && <Text style={s.cellMuted}>{item.podcastName}</Text>}
                        {item.category === 'Package' && item.packageName && <Text style={s.cellMuted}>{item.packageName}</Text>}
                        {item.category === 'Demo'    && (item.stack || item.repoUrl) && <Text style={s.cellMuted}>{[item.stack, item.repoUrl].filter(Boolean).join(' · ')}</Text>}
                        {reshares > 0 && <Text style={s.cellAccent}>{reshares} reshare{reshares > 1 ? 's' : ''}</Text>}
                      </View>
                      {/* Category */}
                      <View style={{ width: COL.category }}>
                        <Text style={[s.cellText, { color: catColor }]}>{cat}</Text>
                      </View>
                      {/* Platform */}
                      <Text style={[s.cellText, { width: COL.platform }]} >{item.platform}</Text>
                      {/* Status */}
                      <View style={{ width: COL.status }}>
                        <StatusBadge status={item.status} />
                      </View>
                      {/* Metric */}
                      <Text style={[s.cellText, { width: COL.metric }]}>{getMetric(item)}</Text>
                      {/* Date */}
                      <Text style={[s.cellText, { width: COL.date }]}>{fmtDate(item.publicationDate)}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}

        <Footer client={clientName} />
      </Page>
    </Document>
  )
}
