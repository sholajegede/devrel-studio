import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

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

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getMetric(item: ReportContentItem): string {
  if (item.category === 'Event')   return (item.attendees ?? 0) > 0 ? `${fmtNum(item.attendees!)} att.` : '—'
  if (item.category === 'Podcast') return (item.downloads  ?? 0) > 0 ? `${fmtNum(item.downloads!)} dl.` : '—'
  if (item.category === 'Package') {
    if ((item.weeklyDownloads ?? 0) > 0) return `${fmtNum(item.weeklyDownloads!)}/wk`
    if ((item.downloads ?? 0) > 0)       return `${fmtNum(item.downloads!)} dl.`
    return '—'
  }
  return (item.views ?? 0) > 0 ? `${fmtNum(item.views!)} views` : '—'
}

const CAT_COLOR: Record<string, string> = {
  Written: C.written, Video: C.video, Event: C.event, Podcast: C.podcast, Package: C.package,
}

const STATUS_CFG: Record<string, { bg: string; fg: string; label: string }> = {
  'Published':        { bg: C.pubBg,       fg: C.pubFg,      label: 'Published' },
  'Draft':            { bg: C.draftBg,     fg: C.draftFg,    label: 'Draft' },
  'Waiting Approval': { bg: C.reviewBg,    fg: C.reviewFg,   label: 'In Review' },
  'Scheduled':        { bg: C.scheduledBg, fg: C.scheduledFg, label: 'Scheduled' },
}

const CATEGORIES = ['Written', 'Video', 'Event', 'Podcast', 'Package']

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
  for (const item of content) {
    const key = new Date(item.publicationDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(item)
  }
  const sortedMonths = Object.entries(byMonth).sort(
    ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
  )

  // Category aggregates
  const catCounts: Record<string, number> = {}
  const catViews:  Record<string, number> = {}
  const catDl:     Record<string, number> = {}
  const catAtt:    Record<string, number> = {}
  for (const item of content) {
    const cat = item.category ?? 'Written'
    catCounts[cat] = (catCounts[cat] ?? 0) + 1
    catViews[cat]  = (catViews[cat]  ?? 0) + (item.views     ?? 0)
    catDl[cat]     = (catDl[cat]     ?? 0) + (item.downloads ?? 0)
    catAtt[cat]    = (catAtt[cat]    ?? 0) + (item.attendees ?? 0)
  }
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
          {CATEGORIES.filter(cat => (catCounts[cat] ?? 0) > 0).map(cat => {
            const count = catCounts[cat] ?? 0
            const pct   = count / total
            const color = CAT_COLOR[cat] ?? C.muted
            const parts = [`${count} ${count === 1 ? 'item' : 'items'}`]
            if (cat === 'Event'                  && (catAtt[cat] ?? 0) > 0) parts.push(`${fmtNum(catAtt[cat])} attendees`)
            if ((cat === 'Package' || cat === 'Podcast') && (catDl[cat] ?? 0) > 0) parts.push(`${fmtNum(catDl[cat])} downloads`)
            if ((cat === 'Written' || cat === 'Video')   && (catViews[cat] ?? 0) > 0) parts.push(`${fmtNum(catViews[cat])} views`)
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
                <Text style={[s.tableHeadCell, { flex: 1 }]}>DL / ATT.</Text>
                <Text style={[s.tableHeadCell, { flex: 1 }]}>RESHARES</Text>
              </View>
              {sortedMonths.map(([month, items], idx) => {
                const pub   = items.filter(i => i.status === 'Published').length
                const views = items.filter(i => !i.category || i.category === 'Written' || i.category === 'Video').reduce((n, i) => n + (i.views ?? 0), 0)
                const dl    = items.filter(i => i.category === 'Package' || i.category === 'Podcast').reduce((n, i) => n + (i.downloads ?? 0), 0)
                const att   = items.filter(i => i.category === 'Event').reduce((n, i) => n + (i.attendees ?? 0), 0)
                const res   = items.reduce((n, i) => n + (i.reshares?.length ?? 0), 0)
                const isLast = idx === sortedMonths.length - 1
                return (
                  <View key={month} style={[s.tableRow, idx % 2 !== 0 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                    <Text style={[s.cellText, { flex: 3 }]}>{month}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{items.length}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{pub}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{views > 0 ? fmtNum(views) : '—'}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{dl > 0 ? fmtNum(dl) : att > 0 ? fmtNum(att) : '—'}</Text>
                    <Text style={[s.cellText, { flex: 1 }]}>{res > 0 ? String(res) : '—'}</Text>
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
          const pub  = items.filter(i => i.status === 'Published').length
          const views = items.filter(i => !i.category || i.category === 'Written' || i.category === 'Video').reduce((n, i) => n + (i.views ?? 0), 0)
          const dl   = items.filter(i => i.category === 'Package' || i.category === 'Podcast').reduce((n, i) => n + (i.downloads ?? 0), 0)
          const att  = items.filter(i => i.category === 'Event').reduce((n, i) => n + (i.attendees ?? 0), 0)
          const res  = items.reduce((n, i) => n + (i.reshares?.length ?? 0), 0)
          const sorted = [...items].sort((a, b) => (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4))

          return (
            <View key={month}>
              {/* Month header */}
              <View style={s.monthHeader}>
                <Text style={s.monthTitle}>{month}</Text>
                <View style={s.monthMetaRow}>
                  <Text style={s.monthMeta}>{pub} of {items.length} published</Text>
                  {views > 0 && <Text style={s.monthMeta}>{fmtNum(views)} views</Text>}
                  {att   > 0 && <Text style={s.monthMeta}>{fmtNum(att)} attendees</Text>}
                  {dl    > 0 && <Text style={s.monthMeta}>{fmtNum(dl)} downloads</Text>}
                  {res   > 0 && <Text style={s.monthMeta}>{res} reshares</Text>}
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
                  const cat     = item.category ?? 'Written'
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
