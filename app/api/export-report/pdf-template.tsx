import React from 'react'
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { CATEGORY_METRIC, aggregate, categoryOf, reshareViews } from '@/lib/metrics'
import { statusLabel } from '@/lib/status'

// ── The client report ─────────────────────────────────────────────────────────
//
// A document one person prepares for a client and the client forwards to their
// own manager. It is designed around that second reader, who has never opened
// the dashboard:
//
//   1. A cover that says who it is for, which month, and who prepared it.
//   2. The results on one page: three numbers at most, each against the month
//      before, then the summary in the author's own words.
//   3. The work, the social posts and the platform numbers, as plain tables.
//   4. The proof: each platform screenshot full width, so the numbers in the
//      tables can be checked without logging into anything.
//
// The look is restraint: one typeface, black and grays plus the client's brand
// colour, thin rules instead of boxes, wide margins, and one grid on every page.
// devrel.studio appears once, as a footer credit.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportContentItem {
  _id?: string
  category?: string
  title: string
  platform: string
  publicationDate: string
  status: string
  contentType?: string
  link?: string
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
  reshares?: { platform: string; link: string; date: string; views?: number }[]
}

export interface ReportHighlight {
  title: string
  platform: string
  category?: string
  metric: number
}

export interface ReportStats {
  published: number
  inProgress: number
  totalViews: number
  totalDownloads: number
  totalAttendees: number
  totalStars?: number
  totalReshares: number
}

/** A platform's own monthly numbers, with the file they were read from. */
export interface ReportPlatformStat {
  platform: string
  month?: string
  views?: number | null
  reads?: number | null
  /** An image the renderer can embed, already downloaded by the route. */
  evidenceImage?: { data: Buffer | Uint8Array; format: 'png' | 'jpg' } | null
  /** A CSV or PDF export, which can only be linked. */
  evidenceName?: string | null
  evidenceUrl?: string | null
}

/** One LinkedIn or X post about the work. */
export interface ReportSocialPost {
  platform: string
  link: string
  date: string
  impressions?: number | null
  /** The piece the post was about. */
  about: string
}

export interface ReportData {
  client: string
  content: ReportContentItem[]
  stats: ReportStats
  period: string
  /** The month before, for the change shown under each headline number. */
  previousStats?: ReportStats | null
  /** "October 2026". */
  previousLabel?: string | null
  /** Who prepared the report, shown on the cover. */
  preparedBy?: string | null
  /**
   * The written half of the report. Optional throughout: a period nobody wrote
   * up still prints, with those sections left out.
   */
  notes?: {
    summary?: string | null
    performanceNote?: string | null
    responseToFeedback?: string | null
    quotes?: { text: string; attribution?: string; link?: string }[]
  } | null
  targets?: { reach?: number | null; published?: number | null } | null
  highlights?: ReportHighlight[]
  platformStats?: ReportPlatformStat[]
  social?: ReportSocialPost[]
  /** How many of the period's pieces carry a tracking link in the agreed format. */
  linkCoverage?: { tagged: number; checked: number } | null
  branding?: { logoUrl?: string | null; brandColor?: string | null } | null
  /** The day the document was generated, `YYYY-MM-DD`. Defaults to today. */
  generatedOn?: string
}

export interface ReportOptions {
  /** A folder holding Inter-400/500/600/700.woff. Without it, Helvetica. */
  fontDir?: string | null
}

// ── Type ──────────────────────────────────────────────────────────────────────

let registeredFontDir: string | null = null

function registerInter(fontDir: string): boolean {
  if (registeredFontDir === fontDir) return true
  try {
    Font.register({
      family: 'Inter',
      fonts: [
        { src: `${fontDir}/Inter-400.woff`, fontWeight: 400 },
        { src: `${fontDir}/Inter-500.woff`, fontWeight: 500 },
        { src: `${fontDir}/Inter-600.woff`, fontWeight: 600 },
        { src: `${fontDir}/Inter-700.woff`, fontWeight: 700 },
      ],
    })
    // Words are never split across lines. A hyphenated "Authentica-ting" reads
    // as a printing error in a document like this.
    Font.registerHyphenationCallback((word) => [word])
    registeredFontDir = fontDir
    return true
  } catch {
    return false
  }
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const INK = '#111111'
const SECONDARY = '#5f5f5f'
const TERTIARY = '#8c8c8c'
const RULE = '#e4e4e4'
const DEFAULT_ACCENT = '#111111'

/** A4 with wide margins. Every page uses the same left edge and width. */
const MARGIN_X = 60
const MARGIN_TOP = 64
const MARGIN_BOTTOM = 72

function makeStyles(family: string, accent: string) {
  return StyleSheet.create({
    page: {
      fontFamily: family,
      fontSize: 9.5,
      // No lineHeight here: an inherited line height stops react-pdf drawing
      // the fixed footer. Each text style sets its own.
      color: INK,
      backgroundColor: '#ffffff',
      paddingTop: MARGIN_TOP,
      paddingBottom: MARGIN_BOTTOM,
      paddingHorizontal: MARGIN_X,
    },

    // Cover
    cover: { flex: 1, justifyContent: 'space-between' },
    coverLogo: { height: 26, maxWidth: 150, objectFit: 'contain', objectPositionX: 0 },
    coverMiddle: { marginTop: 200 },
    coverEyebrow: { fontSize: 8.5, fontWeight: 500, letterSpacing: 1.4, color: accent, textTransform: 'uppercase', marginBottom: 14 },
    coverTitle: { fontSize: 34, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.6 },
    coverPeriod: { fontSize: 34, fontWeight: 400, lineHeight: 1.15, letterSpacing: -0.6, color: TERTIARY },
    coverMeta: { borderTopWidth: 0.6, borderTopColor: RULE, paddingTop: 14, flexDirection: 'row' },
    coverMetaCol: { flex: 1 },
    metaLabel: { fontSize: 7.5, color: TERTIARY, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
    metaValue: { fontSize: 10, fontWeight: 500 },

    // Sections
    section: { marginBottom: 34 },
    eyebrow: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.4, color: TERTIARY, textTransform: 'uppercase', marginBottom: 6 },
    h1: { fontSize: 22, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.2, marginBottom: 22 },
    h2: { fontSize: 13, fontWeight: 600, letterSpacing: -0.1, marginBottom: 10 },
    body: { fontSize: 10.5, lineHeight: 1.6, color: INK, marginBottom: 8 },
    small: { fontSize: 8.5, color: SECONDARY, lineHeight: 1.5 },
    rule: { borderBottomWidth: 0.6, borderBottomColor: RULE },

    // Headline numbers
    figures: { flexDirection: 'row', borderTopWidth: 0.6, borderTopColor: INK, paddingTop: 14, marginBottom: 30 },
    figure: { flex: 1, paddingRight: 16 },
    figureValue: { fontSize: 30, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.1 },
    figureLabel: { fontSize: 9, fontWeight: 500, marginTop: 6 },
    figureDelta: { fontSize: 8.5, color: SECONDARY, marginTop: 2 },
    figureUp: { color: accent },

    // Lists
    highlightRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.6, borderBottomColor: RULE },
    highlightIndex: { width: 22, fontSize: 9, color: TERTIARY },
    highlightTitle: { flex: 1, fontSize: 9.5, fontWeight: 500, paddingRight: 12 },
    highlightMeta: { width: 120, fontSize: 9, color: SECONDARY, textAlign: 'right' },

    quote: { borderLeftWidth: 1.5, borderLeftColor: accent, paddingLeft: 12, marginBottom: 12 },
    quoteText: { fontSize: 10.5, lineHeight: 1.55 },
    quoteBy: { fontSize: 8.5, color: SECONDARY, marginTop: 3 },

    // Tables
    th: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: INK, paddingBottom: 5 },
    thCell: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.9, color: SECONDARY, textTransform: 'uppercase' },
    tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: RULE, paddingVertical: 8 },
    td: { fontSize: 9, lineHeight: 1.45 },
    tdStrong: { fontSize: 9.5, fontWeight: 500, lineHeight: 1.4 },
    tdSub: { fontSize: 8, color: SECONDARY, marginTop: 2 },
    num: { textAlign: 'right' },
    total: { flexDirection: 'row', paddingVertical: 8 },

    // Appendix
    evidence: { marginBottom: 26 },
    evidenceImage: { width: '100%', objectFit: 'contain', borderWidth: 0.6, borderColor: RULE },
    caption: { fontSize: 8.5, color: SECONDARY, marginTop: 8 },
    link: { color: INK, textDecoration: 'none' },

    // Footer
    footer: {
      position: 'absolute',
      left: MARGIN_X,
      right: MARGIN_X,
      bottom: 34,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 0.6,
      borderTopColor: RULE,
      paddingTop: 9,
    },
    footerText: { fontSize: 7.5, color: TERTIARY },
  })
}

type Styles = ReturnType<typeof makeStyles>

// ── Formatting ────────────────────────────────────────────────────────────────

const n = (value: number) => Math.round(value).toLocaleString('en-US')

function shortDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function longDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** "+24% vs October", "New this month", or null when there is nothing to compare. */
function change(current: number, previous: number | null | undefined, previousLabel: string | null | undefined) {
  if (previous == null || !previousLabel) return null
  const month = previousLabel.split(' ')[0]
  if (previous === 0) return current > 0 ? { text: `None in ${month}`, up: true } : null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { text: `Same as ${month}`, up: false }
  return { text: `${pct > 0 ? '+' : ''}${pct}% vs ${month}`, up: pct > 0 }
}

function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

const SOCIAL_PLATFORMS = new Set(['linkedin', 'x', 'twitter', 'twitter/x'])
export function isSocialPlatform(platform: string): boolean {
  return SOCIAL_PLATFORMS.has(platform.trim().toLowerCase())
}

/** The piece's own number, not counting reshares, with its unit. */
function ownResult(item: ReportContentItem): { value: number; unit: string } {
  const category = categoryOf(item)
  const { key, label } = CATEGORY_METRIC[category]
  return { value: (item[key] as number | undefined) ?? 0, unit: label.toLowerCase() }
}

// ── Headline numbers ──────────────────────────────────────────────────────────

interface Figure {
  value: number
  label: string
  previous?: number | null
}

/**
 * Three numbers at most.
 *
 * Pieces shipped and views always lead. The third is whichever other measure
 * the month actually produced the most of — downloads in a package month, the
 * room in an event month — so a month never shows a zero as a headline.
 */
export function headlineFigures(stats: ReportStats, previous?: ReportStats | null): Figure[] {
  const figures: Figure[] = [
    { value: stats.published, label: stats.published === 1 ? 'Piece shipped' : 'Pieces shipped', previous: previous?.published },
    { value: stats.totalViews, label: 'Views, including reshares', previous: previous?.totalViews },
  ]
  const others: Figure[] = [
    { value: stats.totalDownloads, label: 'Downloads', previous: previous?.totalDownloads },
    { value: stats.totalAttendees, label: 'People in the room', previous: previous?.totalAttendees },
    { value: stats.totalStars ?? 0, label: 'GitHub stars', previous: previous?.totalStars ?? null },
  ].filter((figure) => figure.value > 0)
  others.sort((a, b) => b.value - a.value)
  if (others[0]) figures.push(others[0])
  return figures
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function Footer({ s, client, period }: { s: Styles; client: string; period: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        {client} · {period}
      </Text>
      <Text style={s.footerText}>Made with devrel.studio</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  )
}

/** A section title that never sits alone at the bottom of a page. */
function SectionTitle({ s, eyebrow, title }: { s: Styles; eyebrow: string; title: string }) {
  return (
    <View minPresenceAhead={90} wrap={false}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.h2}>{title}</Text>
    </View>
  )
}

const WORK_COLS = { work: '46%', type: '14%', status: '13%', date: '10%', result: '17%' }

function WorkTable({ s, items }: { s: Styles; items: ReportContentItem[] }) {
  const reshareTotal = items.reduce((total, item) => total + reshareViews(item), 0)
  return (
    <View>
      <View style={s.th} fixed={false} wrap={false}>
        <Text style={[s.thCell, { width: WORK_COLS.work }]}>Work</Text>
        <Text style={[s.thCell, { width: WORK_COLS.type }]}>Type</Text>
        <Text style={[s.thCell, { width: WORK_COLS.status }]}>Status</Text>
        <Text style={[s.thCell, { width: WORK_COLS.date }]}>Date</Text>
        <Text style={[s.thCell, s.num, { width: WORK_COLS.result }]}>Result</Text>
      </View>
      {items.map((item, index) => {
        const category = categoryOf(item)
        const result = ownResult(item)
        const reshare = reshareViews(item)
        const context =
          category === 'Event'
            ? [item.eventName, item.eventLocation].filter(Boolean).join(', ')
            : category === 'Podcast'
              ? item.podcastName || item.platform
              : category === 'Package'
                ? item.packageName || item.platform
                : item.platform
        return (
          <View key={item._id ?? index} style={s.tr} wrap={false}>
            <View style={{ width: WORK_COLS.work, paddingRight: 14 }}>
              {item.link ? (
                <Link src={item.link} style={[s.tdStrong, s.link]}>
                  {item.title}
                </Link>
              ) : (
                <Text style={s.tdStrong}>{item.title}</Text>
              )}
              {context ? <Text style={s.tdSub}>{context}</Text> : null}
            </View>
            <Text style={[s.td, { width: WORK_COLS.type }]}>{category}</Text>
            <Text style={[s.td, { width: WORK_COLS.status }]}>
              {statusLabel(item.status, category, item.publicationDate)}
            </Text>
            <Text style={[s.td, { width: WORK_COLS.date }]}>{shortDate(item.publicationDate)}</Text>
            <View style={{ width: WORK_COLS.result }}>
              <Text style={[s.td, s.num]}>
                {result.value > 0 ? `${n(result.value)} ${result.unit}` : 'Not recorded'}
              </Text>
              {reshare > 0 ? <Text style={[s.tdSub, s.num]}>+{n(reshare)} from reshares</Text> : null}
            </View>
          </View>
        )
      })}
      {reshareTotal > 0 ? (
        <Text style={[s.small, { marginTop: 8 }]}>
          Views are the platform&apos;s own count for each piece. Reshare views are listed under each piece and
          in Social posts, and both are included in the headline total.
        </Text>
      ) : null}
    </View>
  )
}

const SOCIAL_COLS = { post: '52%', date: '16%', impressions: '32%' }

function SocialTable({ s, posts }: { s: Styles; posts: ReportSocialPost[] }) {
  return (
    <View>
      <View style={s.th} wrap={false}>
        <Text style={[s.thCell, { width: SOCIAL_COLS.post }]}>Post</Text>
        <Text style={[s.thCell, { width: SOCIAL_COLS.date }]}>Posted</Text>
        <Text style={[s.thCell, s.num, { width: SOCIAL_COLS.impressions }]}>Impressions</Text>
      </View>
      {posts.map((post, index) => (
        <View key={`${post.link}-${index}`} style={s.tr} wrap={false}>
          <View style={{ width: SOCIAL_COLS.post, paddingRight: 14 }}>
            <Link src={post.link} style={[s.tdStrong, s.link]}>
              {post.platform === 'Twitter/X' ? 'X' : post.platform} post
            </Link>
            <Text style={s.tdSub}>About: {post.about}</Text>
          </View>
          <Text style={[s.td, { width: SOCIAL_COLS.date }]}>{shortDate(post.date)}</Text>
          <Text style={[s.td, s.num, { width: SOCIAL_COLS.impressions }]}>
            {post.impressions ? n(post.impressions) : 'Not recorded'}
          </Text>
        </View>
      ))}
    </View>
  )
}

const STAT_COLS = { platform: '34%', views: '22%', reads: '22%', proof: '22%' }

function PlatformTable({ s, stats, period }: { s: Styles; stats: ReportPlatformStat[]; period: string }) {
  return (
    <View>
      <View style={s.th} wrap={false}>
        <Text style={[s.thCell, { width: STAT_COLS.platform }]}>Platform</Text>
        <Text style={[s.thCell, s.num, { width: STAT_COLS.views }]}>Views</Text>
        <Text style={[s.thCell, s.num, { width: STAT_COLS.reads }]}>Reads / reactions</Text>
        <Text style={[s.thCell, s.num, { width: STAT_COLS.proof }]}>Proof</Text>
      </View>
      {stats.map((stat) => (
        <View key={stat.platform} style={s.tr} wrap={false}>
          <Text style={[s.tdStrong, { width: STAT_COLS.platform }]}>{stat.platform}</Text>
          <Text style={[s.td, s.num, { width: STAT_COLS.views }]}>
            {stat.views != null ? n(stat.views) : 'Not provided'}
          </Text>
          <Text style={[s.td, s.num, { width: STAT_COLS.reads }]}>
            {stat.reads != null ? n(stat.reads) : '–'}
          </Text>
          <Text style={[s.td, s.num, { width: STAT_COLS.proof }]}>
            {stat.evidenceImage ? 'Appendix' : stat.evidenceUrl ? 'Linked export' : 'Not provided'}
          </Text>
        </View>
      ))}
      <Text style={[s.small, { marginTop: 8 }]}>
        Totals from each platform&apos;s own dashboard for {period}, which the client cannot see directly.
      </Text>
    </View>
  )
}

// ── Document ──────────────────────────────────────────────────────────────────

export function createReportDocument(data: ReportData, options: ReportOptions = {}) {
  const family = options.fontDir && registerInter(options.fontDir) ? 'Inter' : 'Helvetica'
  const accent = data.branding?.brandColor || DEFAULT_ACCENT
  const s = makeStyles(family, accent)

  const generatedOn = data.generatedOn ?? new Date().toISOString().slice(0, 10)
  const items = [...data.content].sort((a, b) => a.publicationDate.localeCompare(b.publicationDate))
  // Recomputed from the rows so the headline and the table can never disagree.
  const stats: ReportStats = items.length
    ? (() => {
        const totals = aggregate(items)
        return {
          published: totals.published,
          inProgress: data.stats.inProgress,
          totalViews: totals.views,
          totalDownloads: totals.downloads,
          totalAttendees: totals.attendees,
          totalStars: totals.stars,
          totalReshares: totals.reshares,
        }
      })()
    : data.stats
  const figures = headlineFigures(stats, data.previousStats)
  const notes = data.notes ?? null
  const summary = paragraphs(notes?.summary)
  const drivers = paragraphs(notes?.performanceNote)
  const feedback = paragraphs(notes?.responseToFeedback)
  const quotes = notes?.quotes ?? []
  const highlights = (data.highlights ?? []).filter((h) => h.metric > 0).slice(0, 3)
  const social = data.social ?? []
  const platformStats = data.platformStats ?? []
  const evidence = platformStats.filter((stat) => stat.evidenceImage)
  const coverage = data.linkCoverage

  return (
    <Document
      title={`${data.client} developer relations report, ${data.period}`}
      author={data.preparedBy ?? undefined}
      creator="devrel.studio"
      producer="devrel.studio"
    >
      {/* ── Cover ───────────────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <View>
            {data.branding?.logoUrl ? <Image src={data.branding.logoUrl} style={s.coverLogo} /> : null}
          </View>

          <View style={s.coverMiddle}>
            <Text style={s.coverEyebrow}>{data.client}</Text>
            <Text style={s.coverTitle}>Developer relations report</Text>
            <Text style={s.coverPeriod}>{data.period}</Text>
          </View>

          <View style={s.coverMeta}>
            <View style={s.coverMetaCol}>
              <Text style={s.metaLabel}>Prepared for</Text>
              <Text style={s.metaValue}>{data.client}</Text>
            </View>
            <View style={s.coverMetaCol}>
              <Text style={s.metaLabel}>Prepared by</Text>
              <Text style={s.metaValue}>{data.preparedBy || 'Developer relations'}</Text>
            </View>
            <View style={s.coverMetaCol}>
              <Text style={s.metaLabel}>Issued</Text>
              <Text style={s.metaValue}>{longDate(generatedOn)}</Text>
            </View>
          </View>
        </View>
        <Footer s={s} client={data.client} period={data.period} />
      </Page>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{data.period}</Text>
        <Text style={s.h1}>Results</Text>

        <View style={s.figures} wrap={false}>
          {figures.map((figure) => {
            const delta = change(figure.value, figure.previous, data.previousLabel)
            return (
              <View key={figure.label} style={s.figure}>
                <Text style={s.figureValue}>{n(figure.value)}</Text>
                <Text style={s.figureLabel}>{figure.label}</Text>
                {delta ? <Text style={[s.figureDelta, delta.up ? s.figureUp : {}]}>{delta.text}</Text> : null}
              </View>
            )
          })}
        </View>

        {summary.length > 0 && (
          <View style={s.section}>
            <SectionTitle s={s} eyebrow="Summary" title="What happened" />
            {summary.map((text, index) => (
              <Text key={index} style={s.body}>
                {text}
              </Text>
            ))}
          </View>
        )}

        {drivers.length > 0 && (
          <View style={s.section}>
            <SectionTitle s={s} eyebrow="Why" title="What drove it" />
            {drivers.map((text, index) => (
              <Text key={index} style={s.body}>
                {text}
              </Text>
            ))}
          </View>
        )}

        {highlights.length > 0 && (
          <View style={s.section}>
            <SectionTitle s={s} eyebrow="Highlights" title="What performed best" />
            {highlights.map((highlight, index) => {
              const { label } = CATEGORY_METRIC[categoryOf(highlight)]
              return (
                <View key={index} style={s.highlightRow} wrap={false}>
                  <Text style={s.highlightIndex}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={s.highlightTitle}>{highlight.title}</Text>
                  <Text style={s.highlightMeta}>
                    {n(highlight.metric)} {label.toLowerCase()}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {stats.inProgress > 0 && (
          <Text style={s.small}>
            {stats.inProgress} more {stats.inProgress === 1 ? 'piece is' : 'pieces are'} in progress for the
            coming weeks.
          </Text>
        )}
        <Footer s={s} client={data.client} period={data.period} />
      </Page>

      {/* ── Detail ──────────────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <SectionTitle s={s} eyebrow="The work" title={`Shipped in ${data.period}`} />
          {items.length ? (
            <WorkTable s={s} items={items} />
          ) : (
            <Text style={s.small}>Nothing shipped in this period.</Text>
          )}
        </View>

        {(social.length > 0 || (coverage && coverage.checked > 0)) && (
          <View style={s.section}>
            <SectionTitle s={s} eyebrow="Distribution" title="Social posts and tracking" />
            {social.length > 0 ? <SocialTable s={s} posts={social} /> : null}
            {coverage && coverage.checked > 0 ? (
              <Text style={[s.small, { marginTop: 8 }]}>
                {coverage.tagged} of {coverage.checked} pieces this period carry a tracking link in the agreed
                format, so the visits and sign-ups they send are counted in {data.client}&apos;s own analytics.
              </Text>
            ) : null}
          </View>
        )}

        {platformStats.length > 0 && (
          <View style={s.section}>
            <SectionTitle s={s} eyebrow="Platform numbers" title="From each platform's dashboard" />
            <PlatformTable s={s} stats={platformStats} period={data.period} />
          </View>
        )}

        {(feedback.length > 0 || quotes.length > 0) && (
          <View style={s.section}>
            <SectionTitle s={s} eyebrow="Feedback" title="What we heard" />
            {feedback.map((text, index) => (
              <Text key={index} style={s.body}>
                {text}
              </Text>
            ))}
            {quotes.map((quote, index) => (
              <View key={index} style={s.quote} wrap={false}>
                <Text style={s.quoteText}>{quote.text}</Text>
                {quote.attribution ? <Text style={s.quoteBy}>{quote.attribution}</Text> : null}
              </View>
            ))}
          </View>
        )}
        <Footer s={s} client={data.client} period={data.period} />
      </Page>

      {/* ── Appendix: the proof ─────────────────────────────────────────── */}
      {evidence.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.eyebrow}>Appendix</Text>
          <Text style={s.h1}>Platform evidence</Text>
          {evidence.map((stat) => (
            <View key={stat.platform} style={s.evidence} wrap={false}>
              <Image src={stat.evidenceImage as never} style={s.evidenceImage} />
              <Text style={s.caption}>
                {stat.platform} dashboard, {data.period}.
                {stat.views != null ? ` ${n(stat.views)} views` : ''}
                {stat.reads != null ? `, ${n(stat.reads)} reads or reactions.` : stat.views != null ? '.' : ''}
              </Text>
            </View>
          ))}
          {platformStats
            .filter((stat) => !stat.evidenceImage && stat.evidenceUrl)
            .map((stat) => (
              <Text key={stat.platform} style={s.small}>
                {stat.platform} export for {data.period}:{' '}
                <Link src={stat.evidenceUrl!} style={s.link}>
                  {stat.evidenceName ?? 'download'}
                </Link>
              </Text>
            ))}
          <Footer s={s} client={data.client} period={data.period} />
        </Page>
      )}
    </Document>
  )
}
