'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { AdminTour, AdminTourTriggerButton, TourVariant } from '@/components/admin-onboarding-tour'
import {
  ContentEntry,
  CATEGORIES,
  STATUSES,
  PLATFORMS,
  getMonthsFromContent,
  formatMonthLabel,
  getMetricValue,
  getMetricLabel,
  getCategoryColor,
  type Category,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Search, ExternalLink, Edit, Trash2, PlusCircle, Download,
  Eye, Link2, CheckCircle2, Pencil, AlertCircle, Clock,
  FileText, Video, MapPin, Mic, Package,
  Users, Headphones, TrendingUp, RefreshCw,
} from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useRouter } from 'next/navigation'
import { useUserContext } from '@/contexts/user-context'
import PageLoader from '@/components/page-loader'

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Written: FileText,
  Video:   Video,
  Event:   MapPin,
  Podcast: Mic,
  Package: Package,
}

export default function ContentListPage() {
  const { profile } = useUserContext()
  const [searchQuery,    setSearchQuery]    = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter,   setStatusFilter]   = useState('all')
  const [monthFilter,    setMonthFilter]    = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [deleteId,       setDeleteId]       = useState<Id<"contentEntries"> | null>(null)
  const [contentTourControls, setContentTourControls] = useState<{ startTour: () => void } | null>(null)
  const [isTimeout,      setIsTimeout]      = useState(false)
  const router = useRouter()

  const content = useQuery(
    api.content.getAllContent,
    profile?._id ? { userId: profile._id as Id<"users"> } : "skip"
  )

  const deleteEntry = useMutation(api.content.deleteContent)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (content === undefined) setIsTimeout(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [content])

  // All unique platforms present in this user's content (for filter)
  const availablePlatforms = useMemo(() => {
    if (!content) return []
    const set = new Set<string>()
    ;(content as ContentEntry[]).forEach((c) => { if (c.platform) set.add(c.platform) })
    return [...set].sort()
  }, [content])

  const filteredContent = useMemo(() => {
    if (!content) return []
    let filtered = [...content] as ContentEntry[]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) => c.title.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((c) => (c.category ?? 'Written') === categoryFilter)
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter)
    }
    if (monthFilter !== 'all') {
      filtered = filtered.filter((c) => {
        const date = new Date(c.publicationDate)
        const key  = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return key === monthFilter
      })
    }
    if (platformFilter !== 'all') {
      filtered = filtered.filter((c) => c.platform === platformFilter)
    }

    filtered.sort((a, b) => new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime())
    return filtered
  }, [content, searchQuery, categoryFilter, statusFilter, monthFilter, platformFilter])

  if (!profile) return <PageLoader />

  const handleDelete = async (id: Id<"contentEntries">) => {
    await deleteEntry({ id })
    setDeleteId(null)
  }

  const hasActiveFilters =
    searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' ||
    monthFilter !== 'all' || platformFilter !== 'all'

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setMonthFilter('all')
    setPlatformFilter('all')
  }

  const exportToCSV = () => {
    const headers = [
      'Category', 'Title', 'Link', 'Tracking Link', 'Platform',
      'Publication Date', 'Status', 'Views', 'Downloads', 'Attendees',
      'Content Type', 'Tags', 'Notes',
    ]
    const rows = filteredContent.map((c) => [
      c.category ?? 'Written', c.title, c.link, c.trackingLink, c.platform,
      c.publicationDate, c.status, c.views ?? '', c.downloads ?? '', c.attendees ?? '',
      c.contentType, c.tags.join('; '), c.notes,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `content-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':        return <Badge variant="secondary" className="gap-1 font-normal"><CheckCircle2 className="h-3 w-3" />Published</Badge>
      case 'Draft':            return <Badge variant="outline"   className="gap-1 font-normal"><Pencil className="h-3 w-3" />Draft</Badge>
      case 'Waiting Approval': return <Badge variant="outline"   className="gap-1 font-normal text-amber-600 border-amber-300"><AlertCircle className="h-3 w-3" />Waiting</Badge>
      case 'Scheduled':        return <Badge variant="outline"   className="gap-1 font-normal"><Clock className="h-3 w-3" />Scheduled</Badge>
      default:                 return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getMetricDisplay = (entry: ContentEntry) => {
    const cat   = entry.category ?? 'Written'
    const value = getMetricValue(entry)
    const label = getMetricLabel(entry.category)
    if (value === 0) return null
    const Icon = cat === 'Event' ? Users : cat === 'Podcast' ? Headphones : cat === 'Package' ? Download : Eye
    return (
      <span className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {value.toLocaleString()} {label.toLowerCase()}
        {cat === 'Package' && (entry.weeklyDownloads ?? 0) > 0 && (
          <span className="text-muted-foreground/70 flex items-center gap-0.5 ml-1">
            · <TrendingUp className="h-2.5 w-2.5" /> {entry.weeklyDownloads!.toLocaleString()}/wk
          </span>
        )}
      </span>
    )
  }

  const months = content ? getMonthsFromContent(content as ContentEntry[]) : []

  if (content === undefined) {
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

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">All Content</h1>
          <p className="text-sm text-muted-foreground">
            {filteredContent.length} {hasActiveFilters ? 'matching ' : ''}
            {filteredContent.length === 1 ? 'entry' : 'entries'}
            {content.length !== filteredContent.length && ` of ${content.length} total`}
          </p>
        </div>
        <div className="flex gap-2">
          <AdminTourTriggerButton onStartTour={() => contentTourControls?.startTour()} />
          <Button variant="outline" onClick={exportToCSV} size="sm" className="gap-1.5 bg-transparent">
            <Download className="h-3.5 w-3.5" />Export CSV
          </Button>
          <Link href="/dashboard/add" data-tour="content-add">
            <Button size="sm" className="gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />Add Entry
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6" data-tour="content-filters">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-end">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search title or tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Month */}
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat]
                  return (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />{cat}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {/* Platform */}
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {availablePlatforms.length > 0
                  ? availablePlatforms.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))
                  : PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))
                }
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content list */}
      <div className="space-y-3">
        {filteredContent.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {hasActiveFilters ? 'No entries match these filters.' : 'No content yet.'}
              </p>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3">
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredContent.map((entry) => {
            const cat    = (entry.category ?? 'Written') as Category
            const Icon   = CATEGORY_ICONS[cat] ?? FileText
            const metric = getMetricDisplay(entry)

            return (
              <Card key={entry._id} className="transition-colors hover:border-foreground/20">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
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
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getStatusBadge(entry.status)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <Badge variant="outline" className={`gap-1 text-xs ${getCategoryColor(cat)}`}>
                        <Icon className="h-3 w-3" />{cat}
                      </Badge>
                      <span>{entry.platform}</span>
                      <span>{entry.contentType}</span>
                      <span>
                        {new Date(entry.publicationDate).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                      {metric && <span className="flex items-center gap-1">{metric}</span>}
                    </div>

                    {entry.trackingLink && (cat === 'Written' || cat === 'Video') && (
                      <div className="flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <code className="flex-1 truncate text-xs text-muted-foreground">{entry.trackingLink}</code>
                        <button type="button" className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => navigator.clipboard.writeText(entry.trackingLink)}>Copy</button>
                        <Link href={entry.trackingLink} target="_blank" className="text-xs text-muted-foreground hover:text-foreground">Open</Link>
                      </div>
                    )}

                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs font-normal">{tag}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Link href={`/dashboard/edit/${entry._id}`}>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs bg-transparent">
                          <Edit className="h-3 w-3" />Edit
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm"
                        className="h-7 gap-1 text-xs bg-transparent text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(entry._id)}>
                        <Trash2 className="h-3 w-3" />Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminTour
        variant={'content' as TourVariant}
        autoStart
        onTourControlReady={setContentTourControls}
      />
    </main>
  )
}
