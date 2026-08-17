import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { CATEGORIES, type Category } from '@/lib/types'
import { aggregate, aggregateByCategory, categoryOf, formatCompact } from '@/lib/metrics'
import { CATEGORY_META, getCategoryColor } from '@/lib/category-meta'
import { PlatformIcon } from '@/lib/platform-meta'
import { siteOrigin } from '@/lib/site'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  Eye,
  Github,
  Globe,
  Share2,
  Star,
  Users,
} from 'lucide-react'

// ── Public portfolio ──────────────────────────────────────────────────────────
//
// Reachable as devrel.studio/@handle — see the rewrite in proxy.ts for why the
// page lives under /portfolio.
//
// Rendered on the server so it is indexable and shows up in a link preview,
// which is the whole point of a portfolio: it is the surface a DevRel actually
// shares. Revalidated rather than dynamic — the content is published work, so
// being a few minutes stale costs nothing.

export const revalidate = 300

/** Enough that most portfolios are a single page, few enough to stay fast. */
const ENTRIES_PER_PAGE = 50

const pagerClass =
  'inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'

function pillClass(active: boolean): string {
  return [
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
    active
      ? 'border-foreground/25 bg-secondary text-foreground'
      : 'border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground',
  ].join(' ')
}

type PortfolioData = NonNullable<
  Awaited<ReturnType<typeof loadPortfolio>>
>

async function loadPortfolio(handle: string) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return null

  try {
    return await new ConvexHttpClient(convexUrl).query(api.portfolio.getPortfolio, {
      handle,
    })
  } catch (error) {
    console.error('[portfolio] load failed for', handle, error)
    return null
  }
}

function displayName(profile: PortfolioData['profile']): string {
  const name = `${profile.firstName} ${profile.lastName}`.trim()
  return name || `@${profile.handle}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const data = await loadPortfolio(handle)

  if (!data) {
    return { title: 'Portfolio not found | DevRel Studio' }
  }

  const name = displayName(data.profile)
  const description =
    data.profile.bio ||
    `${data.entries.length} published pieces of developer content by ${name}.`

  return {
    title: `${name} · DevRel Portfolio`,
    description,
    // Filter and page live in the query string, which would otherwise present a
    // crawler with a dozen near-identical pages. Point every variant back at the
    // unfiltered first page.
    alternates: { canonical: `${siteOrigin()}/@${data.profile.handle}` },
    openGraph: {
      title: `${name} · DevRel Portfolio`,
      description,
      type: 'profile',
      // `images` is deliberately not set: Next uses opengraph-image.tsx in this
      // folder unless metadata names an image explicitly, and the generated card
      // (name, handle, headline stats) is a far better preview than an avatar.
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} · DevRel Portfolio`,
      description,
    },
  }
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function EntryRow({ entry }: { entry: PortfolioData['entries'][number] }) {
  const category = categoryOf(entry)
  const Icon = CATEGORY_META[category].icon
  const MetricIcon = CATEGORY_META[category].metricIcon

  const metric =
    category === 'Package'
      ? entry.downloads
      : category === 'Event'
        ? entry.attendees
        : category === 'Demo'
          ? entry.stars
          : category === 'Podcast'
            ? entry.downloads
            : entry.views

  // The line under the title changes with the category — a talk is defined by
  // where it was given, a package by its name on npm.
  const subtitle =
    category === 'Event'
      ? [entry.eventName, entry.eventLocation].filter(Boolean).join(' · ')
      : category === 'Podcast'
        ? entry.podcastName
        : category === 'Package'
          ? entry.packageName
          : category === 'Demo'
            ? entry.stack
            : null

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="font-medium text-foreground group-hover:text-accent transition-colors">
            {entry.title}
          </span>
          {entry.link && (
            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>

        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground truncate">{subtitle}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="outline" className={`gap-1 text-xs ${getCategoryColor(category)}`}>
            <Icon className="h-3 w-3" />
            {category}
          </Badge>
          <span className="inline-flex items-center gap-1.5">
            <PlatformIcon platform={entry.platform} size={13} />
            {entry.platform}
          </span>
          <span>
            {new Date(entry.publicationDate).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })}
          </span>
          {!!metric && metric > 0 && (
            <span className="inline-flex items-center gap-1">
              <MetricIcon className="h-3 w-3" />
              {metric.toLocaleString()}
            </span>
          )}
          {entry.reshareCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Share2 className="h-3 w-3" />
              {entry.reshareCount}
            </span>
          )}
        </div>
      </div>
    </>
  )

  const className =
    'group flex gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20'

  return entry.link ? (
    <a href={entry.link} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const { handle } = await params
  const { category: categoryParam, page: pageParam } = await searchParams
  const data = await loadPortfolio(handle)

  if (!data) notFound()

  const { profile, entries } = data
  const name = displayName(profile)

  // Totals and per-category counts describe the whole body of work, so they are
  // deliberately computed before any filtering — narrowing to Video should not
  // make someone's lifetime view count appear to drop.
  const totals = aggregate(entries)
  const byCategory = aggregateByCategory(entries)

  const activeCategory = CATEGORIES.includes(categoryParam as Category)
    ? (categoryParam as Category)
    : null

  const filtered = activeCategory
    ? entries.filter((entry) => categoryOf(entry) === activeCategory)
    : entries

  const pageCount = Math.max(1, Math.ceil(filtered.length / ENTRIES_PER_PAGE))
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pageCount)
  const visible = filtered.slice((page - 1) * ENTRIES_PER_PAGE, page * ENTRIES_PER_PAGE)

  const hrefFor = (next: { category?: Category | null; page?: number }) => {
    const query = new URLSearchParams()
    const cat = next.category === undefined ? activeCategory : next.category
    if (cat) query.set('category', cat)
    if (next.page && next.page > 1) query.set('page', String(next.page))
    const qs = query.toString()
    return `/@${profile.handle}${qs ? `?${qs}` : ''}`
  }

  const socials = [
    profile.websiteUrl && {
      href: profile.websiteUrl.startsWith('http')
        ? profile.websiteUrl
        : `https://${profile.websiteUrl}`,
      icon: Globe,
      label: profile.websiteUrl.replace(/^https?:\/\//, ''),
    },
    profile.githubUsername && {
      href: `https://github.com/${profile.githubUsername}`,
      icon: Github,
      label: profile.githubUsername,
    },
    profile.twitterUsername && {
      href: `https://x.com/${profile.twitterUsername}`,
      icon: ExternalLink,
      label: `@${profile.twitterUsername}`,
    },
  ].filter(Boolean) as { href: string; icon: React.ElementType; label: string }[]

  // Only show tiles for metrics this person actually has — a portfolio with no
  // packages should not display "0 downloads".
  const statTiles = [
    { icon: Eye, label: 'Views', value: totals.views },
    { icon: Download, label: 'Downloads', value: totals.downloads },
    { icon: Users, label: 'Attendees', value: totals.attendees },
    { icon: Star, label: 'Stars', value: totals.stars },
  ].filter((tile) => tile.value > 0)

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-16">

        {/* ── Identity ── */}
        <header className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {profile.imageUrl ? (
              <Image
                src={profile.imageUrl}
                alt={name}
                width={80}
                height={80}
                className="rounded-full border border-border"
                unoptimized
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                <span className="text-2xl font-semibold text-foreground">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {name}
              </h1>
              <p className="text-muted-foreground">@{profile.handle}</p>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {profile.bio}
            </p>
          )}

          {socials.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {socials.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <social.icon className="h-3.5 w-3.5" />
                  {social.label}
                </a>
              ))}
            </div>
          )}
        </header>

        {entries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-16 text-center">
            <p className="text-muted-foreground">
              Nothing published here yet — check back soon.
            </p>
          </div>
        ) : (
          <>
            {/* ── Totals ── */}
            <section className="mb-10">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatTile
                  icon={CATEGORY_META.Written.icon}
                  label="Published"
                  value={totals.published.toLocaleString()}
                />
                {statTiles.map((tile) => (
                  <StatTile
                    key={tile.label}
                    icon={tile.icon}
                    label={tile.label}
                    value={formatCompact(tile.value)}
                  />
                ))}
              </div>
            </section>

            {/* ── Per-category filter ── */}
            <section className="mb-8 flex flex-wrap gap-2">
              <Link
                href={hrefFor({ category: null, page: 1 })}
                scroll={false}
                aria-current={activeCategory === null ? 'true' : undefined}
                className={pillClass(activeCategory === null)}
              >
                All
                <span className="tabular-nums opacity-60">{entries.length}</span>
              </Link>

              {CATEGORIES.filter((cat) => byCategory[cat as Category].count > 0).map(
                (cat) => {
                  const Icon = CATEGORY_META[cat as Category].icon
                  const isActive = activeCategory === cat
                  return (
                    <Link
                      key={cat}
                      // Clicking the active pill clears the filter, so the pills
                      // are a toggle rather than a one-way trip.
                      href={hrefFor({ category: isActive ? null : (cat as Category), page: 1 })}
                      scroll={false}
                      aria-current={isActive ? 'true' : undefined}
                      className={pillClass(isActive)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cat}
                      <span className="tabular-nums opacity-60">
                        {byCategory[cat as Category].count}
                      </span>
                    </Link>
                  )
                },
              )}
            </section>

            {/* ── Work, newest first ── */}
            <section className="space-y-3">
              {visible.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </section>

            {/* ── Pagination ── */}
            {pageCount > 1 && (
              <nav
                className="mt-8 flex items-center justify-between border-t border-border pt-6"
                aria-label="Portfolio pages"
              >
                {page > 1 ? (
                  <Link href={hrefFor({ page: page - 1 })} className={pagerClass}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Newer
                  </Link>
                ) : (
                  <span />
                )}

                <span className="text-sm text-muted-foreground tabular-nums">
                  Page {page} of {pageCount}
                </span>

                {page < pageCount ? (
                  <Link href={hrefFor({ page: page + 1 })} className={pagerClass}>
                    Older
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}

        <footer className="mt-16 border-t border-border pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Image
              src="/images/devrel-logo.png"
              alt=""
              width={18}
              height={18}
              className="rounded opacity-80"
            />
            Built with devrel<span className="opacity-60">.studio</span>
          </Link>
        </footer>
      </main>
    </div>
  )
}
