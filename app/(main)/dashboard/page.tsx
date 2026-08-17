'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  ContentEntry,
  getMonthsFromContent,
  formatMonthLabel,
  CATEGORIES,
  type Category,
} from '@/lib/types'
import { aggregate, categoryOf } from '@/lib/metrics'
import { CATEGORY_META, getCategoryColor } from '@/lib/category-meta'
import { EntryMetric } from '@/components/dashboard/entry-metric'
import { FeedbackInbox } from '@/components/dashboard/feedback-inbox'
import { GettingStarted } from '@/components/dashboard/getting-started'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  FileText, Eye, Download, Users, Star,
  ExternalLink, RefreshCw, CheckCircle2, Clock, AlertCircle,
  Pencil, PlusCircle, Edit, Calendar, X,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import type { DateRange } from 'react-day-picker'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useRouter } from 'next/navigation'
import { useUserContext } from '@/contexts/user-context'
import PageLoader from '@/components/page-loader'
import { AdminTour, AdminTourTriggerButton } from '@/components/admin-onboarding-tour'

const chartConfig = {
  published:  { label: 'Published',   color: 'hsl(var(--accent))' },
  inProgress: { label: 'In Progress', color: 'hsl(var(--muted-foreground))' },
} satisfies ChartConfig

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function DashboardPage() {
  const { profile } = useUserContext()
  const [selectedMonth,  setSelectedMonth]  = useState<string>(currentMonthKey())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dateRange,      setDateRange]      = useState<DateRange | undefined>(undefined)
  const [rangeOpen,      setRangeOpen]      = useState(false)
  const [isTimeout,      setIsTimeout]      = useState(false)
  const [tourControls,   setTourControls]   = useState<{ startTour: () => void } | null>(null)

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value)
    setDateRange(undefined)
  }

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    if (range?.from) setSelectedMonth('all')
    if (range?.from && range?.to) setRangeOpen(false)
  }

  const clearDateRange = () => {
    setDateRange(undefined)
    setSelectedMonth(currentMonthKey())
  }

  const formatRangeLabel = (range: DateRange) => {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (range.from && range.to) return `${fmt(range.from)} – ${fmt(range.to)}`
    if (range.from) return `From ${fmt(range.from)}`
    return 'Date Range'
  }
  const router = useRouter()

  const rawContent = useQuery(
    api.content.getAllContent,
    profile?._id ? {} : "skip"
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      if (rawContent === undefined) setIsTimeout(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [rawContent])

  const months = useMemo(
    () => rawContent ? getMonthsFromContent(rawContent as ContentEntry[]) : [],
    [rawContent]
  )

  // Chart data: last 6 months of published vs in-progress
  const chartData = useMemo(() => {
    if (!rawContent) return []
    const map: Record<string, { month: string; published: number; inProgress: number }> = {}
    for (const entry of rawContent as ContentEntry[]) {
      const date = new Date(entry.publicationDate)
      const key  = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!map[key]) map[key] = { month: label, published: 0, inProgress: 0 }
      if (entry.status === 'Published') map[key].published++
      else map[key].inProgress++
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => v)
  }, [rawContent])

  const filteredContent = useMemo(() => {
    if (!rawContent) return []
    let result = rawContent as ContentEntry[]
    if (dateRange?.from) {
      const from = dateRange.from
      const to = dateRange.to ? new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate(), 23, 59, 59, 999) : from
      result = result.filter((entry) => {
        const date = new Date(entry.publicationDate)
        return date >= from && date <= to
      })
    } else if (selectedMonth !== 'all') {
      result = result.filter((entry) => {
        const date = new Date(entry.publicationDate)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return key === selectedMonth
      })
    }
    if (categoryFilter !== 'all') {
      result = result.filter((e) => (e.category ?? 'Written') === categoryFilter)
    }
    return result
  }, [rawContent, selectedMonth, categoryFilter, dateRange])

  if (!profile) return <PageLoader />

  if (rawContent === undefined) {
    if (isTimeout) {
      return (
        <main className="px-6 lg:px-10 py-8">
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium">Taking longer than expected…</p>
              <p className="text-sm text-muted-foreground mt-1">Content is taking a while to load</p>
            </div>
            <Button onClick={() => router.refresh()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />Retry
            </Button>
          </div>
        </main>
      )
    }
    return <PageLoader />
  }

  // ── Derived stats ─────────────────────────────────────────────────────────────

  const totals = aggregate(filteredContent)

  const byMonth: Record<string, ContentEntry[]> = {}
  for (const entry of filteredContent) {
    const date = new Date(entry.publicationDate)
    const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(entry)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':       return <Badge variant="secondary" className="gap-1 font-normal text-xs shrink-0"><CheckCircle2 className="h-3 w-3" />Published</Badge>
      case 'Draft':           return <Badge variant="outline"   className="gap-1 font-normal text-xs shrink-0"><Pencil className="h-3 w-3" />Draft</Badge>
      case 'Waiting Approval':return <Badge variant="outline"   className="gap-1 font-normal text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-500/40 shrink-0"><AlertCircle className="h-3 w-3" />Waiting</Badge>
      case 'Scheduled':       return <Badge variant="outline"   className="gap-1 font-normal text-xs shrink-0"><Clock className="h-3 w-3" />Scheduled</Badge>
      default:                return <Badge variant="secondary" className="text-xs shrink-0">{status}</Badge>
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminTour variant="dashboard" autoStart onTourControlReady={setTourControls} />

      <main className="px-6 lg:px-10 py-8 max-w-400">

        <RoleNotice />
        <GettingStarted />
        <FeedbackInbox />

        {/* Page heading */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
            <p className="text-sm text-muted-foreground">
              {filteredContent.length} {filteredContent.length === 1 ? 'entry' : 'entries'} this period
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap" data-tour="admin-filters">
            <Select value={selectedMonth} onValueChange={handleMonthChange} disabled={!!dateRange?.from}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" />
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>{formatMonthLabel(month)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={dateRange?.from ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 gap-1.5 text-sm font-normal"
                >
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {dateRange?.from ? formatRangeLabel(dateRange) : 'Date Range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={handleRangeSelect}
                  numberOfMonths={2}
                  initialFocus
                />
                {dateRange?.from && (
                  <div className="border-t p-2">
                    <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs" onClick={clearDateRange}>
                      <X className="h-3 w-3" />Clear range
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_META[cat].icon
                  return (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{cat}</span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {tourControls && <AdminTourTriggerButton onStartTour={tourControls.startTour} />}

            <Link href="/dashboard/add">
              <Button size="sm" className="h-9 gap-1.5" data-tour="admin-add-button">
                <PlusCircle className="h-3.5 w-3.5" />Add New
              </Button>
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" data-tour="admin-stats">
          {[
            { label: 'Published',   value: totals.published,  icon: null },
            { label: 'In Progress', value: totals.inProgress, icon: null },
            { label: 'Views',       value: totals.views,      icon: Eye },
            { label: 'Downloads',   value: totals.downloads,  icon: Download },
            { label: 'Attendees',   value: totals.attendees,  icon: Users },
            { label: 'Stars',       value: totals.stars,      icon: Star },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-5">
              {Icon && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              )}
              {!Icon && <p className="text-sm text-muted-foreground mb-1">{label}</p>}
              <p className="text-3xl font-semibold text-foreground">
                {value > 0 ? value.toLocaleString() : label === 'Published' || label === 'In Progress' ? value : '—'}
              </p>
            </div>
          ))}
        </div>

        {/* Chart + content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 mb-6">

          {/* Bar chart */}
          {chartData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Content published per month</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-50 w-full">
                  <BarChart data={chartData} barCategoryGap="30%">
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="published"  fill="var(--color-published)"  radius={[4, 4, 0, 0]} />
                    <Bar dataKey="inProgress" fill="var(--color-inProgress)" radius={[4, 4, 0, 0]} opacity={0.45} />
                  </BarChart>
                </ChartContainer>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm bg-accent inline-block" />Published
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/45 inline-block" />In Progress
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick stats breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {selectedMonth === 'all' ? 'All time breakdown' : `${formatMonthLabel(selectedMonth)} breakdown`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {CATEGORIES.map((cat) => {
                const entries = filteredContent.filter((e) => (e.category ?? 'Written') === cat)
                if (entries.length === 0) return null
                const Icon = CATEGORY_META[cat].icon
                const pct = filteredContent.length > 0 ? Math.round((entries.length / filteredContent.length) * 100) : 0
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-foreground">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {cat}
                      </span>
                      <span className="text-muted-foreground">{entries.length} · {pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )
              })}
              {filteredContent.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No entries this period</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Content by month */}
        <div className="space-y-5" data-tour="admin-content">
          {Object.entries(byMonth)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([month, entries]) => {
              const monthTotals = aggregate(entries)

              return (
                <div key={month} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-start sm:items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
                    <h3 className="font-medium text-foreground">{month}</h3>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground ml-auto">
                      {monthTotals.views > 0     && <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{monthTotals.views.toLocaleString()} views</span>}
                      {monthTotals.attendees > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{monthTotals.attendees.toLocaleString()} attendees</span>}
                      {monthTotals.downloads > 0 && <span className="flex items-center gap-1"><Download className="h-3 w-3" />{monthTotals.downloads.toLocaleString()} downloads</span>}
                      {monthTotals.stars > 0     && <span className="flex items-center gap-1"><Star className="h-3 w-3" />{monthTotals.stars.toLocaleString()} stars</span>}
                      <span className="hidden sm:inline text-border">|</span>
                      <span>{monthTotals.published} of {entries.length} delivered</span>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {entries
                      .sort((a, b) => {
                        const order: Record<string, number> = { Published: 0, 'Waiting Approval': 1, Draft: 2, Scheduled: 3 }
                        return (order[a.status] ?? 4) - (order[b.status] ?? 4)
                      })
                      .map((entry, idx) => {
                        const cat  = categoryOf(entry)
                        const Icon = CATEGORY_META[cat].icon

                        return (
                          <div key={entry._id} className="flex flex-col gap-2 px-4 py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                {entry.link ? (
                                  <Link href={entry.link} target="_blank"
                                    className="group inline-flex items-start gap-1.5 font-medium text-foreground hover:underline">
                                    <span className="line-clamp-2">{entry.title}</span>
                                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                                  </Link>
                                ) : (
                                  <span className="font-medium text-foreground">{entry.title}</span>
                                )}
                                {entry.category === 'Event' && (entry.eventName || entry.eventLocation) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {[entry.eventName, entry.eventLocation].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                                {entry.category === 'Podcast' && entry.podcastName && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{entry.podcastName}</p>
                                )}
                                {entry.category === 'Package' && entry.packageName && (
                                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{entry.packageName}</p>
                                )}
                                {entry.category === 'Demo' && (entry.stack || entry.repoUrl) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {[entry.stack, entry.repoUrl].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {getStatusBadge(entry.status)}
                                <Link href={`/dashboard/edit/${entry._id}`}>
                                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                                    data-tour={idx === 0 ? 'admin-edit-button' : undefined}>
                                    <Edit className="h-3 w-3" />Edit
                                  </Button>
                                </Link>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <Badge variant="outline" className={`gap-1 text-xs ${getCategoryColor(cat)}`}>
                                <Icon className="h-3 w-3" />{cat}
                              </Badge>
                              <span>{entry.platform}</span>
                              <span>{entry.contentType}</span>
                              <span>{new Date(entry.publicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              <EntryMetric entry={entry} />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )
            })}
        </div>

        {filteredContent.length === 0 && (
          <div className="rounded-xl border border-border bg-card py-16 text-center">
            <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground mb-4">No content found for this period.</p>
            <Link href="/dashboard/add"><Button size="sm">Add Content</Button></Link>
          </div>
        )}

      </main>
    </>
  )
}
