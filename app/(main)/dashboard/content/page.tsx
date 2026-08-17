'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { AdminTour, AdminTourTriggerButton, TourVariant } from '@/components/admin-onboarding-tour'
import { useWorkspaceRole } from '@/hooks/use-workspace-role'
import { RoleNotice } from '@/components/dashboard/role-notice'
import {
  ContentEntry,
  CATEGORIES,
  STATUSES,
  PLATFORMS,
  getMonthsFromContent,
  formatMonthLabel,
} from '@/lib/types'
import { categoryOf } from '@/lib/metrics'
import { CATEGORY_META, getCategoryColor } from '@/lib/category-meta'
import { PlatformIcon } from '@/lib/platform-meta'
import { EntryMetric } from '@/components/dashboard/entry-metric'
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
  Search, ExternalLink, Edit, Trash2, PlusCircle, Download, Copy,
  Link2, CheckCircle2, Pencil, AlertCircle, Clock,
  FileText, RefreshCw,
} from 'lucide-react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useRouter } from 'next/navigation'
import { useUserContext } from '@/contexts/user-context'
import PageLoader from '@/components/page-loader'
import { toast } from 'sonner'

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
  const [isSyncing,      setIsSyncing]      = useState(false)
  const router = useRouter()

  const syncMyStats = useAction(api.sync.syncMyStats)
  const { can } = useWorkspaceRole()

  const content = useQuery(
    api.content.getAllContent,
    profile?._id ? {} : "skip"
  )

  const deleteEntry = useMutation(api.content.deleteContent)
  const duplicateEntry = useMutation(api.content.duplicateContent)
  const restoreEntry = useMutation(api.content.restoreContent)

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

  // ── Stat sync ─────────────────────────────────────────────────────────────
  // npm downloads and GitHub stars refresh on a daily cron; the button below is
  // the manual "don't wait until tomorrow" path. Only entries that carry a
  // package name or repo URL can be synced, so it hides when there are none.
  //
  // This has to sit above the `!profile` return with the other hooks. It was
  // below it, so the first render (no profile yet) ran one fewer hook than the
  // second, and React threw "rendered more hooks than during the previous
  // render" the moment the profile arrived.
  const syncableCount = useMemo(() => {
    if (!content) return 0
    return (content as ContentEntry[]).filter(
      (c) => c.packageName?.trim() || c.repoUrl?.trim()
    ).length
  }, [content])

  if (!profile) return <PageLoader />

  const handleDelete = async (id: Id<"contentEntries">) => {
    // Hold the row before it goes, so the toast can offer it back. This covers
    // the case that actually happens — an accidental click, undone within
    // seconds — without a trash table that then needs its own lifecycle.
    const removed = (content as ContentEntry[] | undefined)?.find((c) => c._id === id)

    await deleteEntry({ id })
    setDeleteId(null)

    toast.success('Entry deleted', {
      action: removed
        ? {
            label: 'Undo',
            onClick: async () => {
              const {
                _id, _creationTime, userId, workspaceId, updatedAt,
                statsSyncedAt, statsSyncError,
                ...entry
              } = removed as Record<string, unknown> & ContentEntry

              try {
                await restoreEntry({ entry: entry as never })
                toast.success('Entry restored')
              } catch {
                toast.error('Could not restore that entry')
              }
            },
          }
        : undefined,
    })
  }

  const handleDuplicate = async (id: Id<"contentEntries">) => {
    try {
      const newId = await duplicateEntry({ id })
      toast.success('Copied — opening the new draft')
      router.push(`/dashboard/edit/${newId}`)
    } catch {
      toast.error('Could not duplicate that entry')
    }
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

  const refreshStats = async () => {
    setIsSyncing(true)
    try {
      const result = await syncMyStats({})
      if (result.total === 0) {
        toast.info('Nothing to sync yet')
      } else if (result.failed > 0) {
        toast.warning(
          `Updated ${result.synced} of ${result.total} — ${result.failed} could not be reached`
        )
      } else {
        toast.success(`Updated ${result.synced} ${result.synced === 1 ? 'entry' : 'entries'}`)
      }
    } catch (error) {
      console.error('[content] stat sync failed:', error)
      toast.error('Could not refresh stats. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Category', 'Title', 'Link', 'Tracking Link', 'Platform',
      'Publication Date', 'Status', 'Views', 'Downloads', 'Attendees', 'Stars',
      'Content Type', 'Tags', 'Notes',
    ]
    const rows = filteredContent.map((c) => [
      c.category ?? 'Written', c.title, c.link, c.trackingLink, c.platform,
      c.publicationDate, c.status, c.views ?? '', c.downloads ?? '', c.attendees ?? '', c.stars ?? '',
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
      case 'Waiting Approval': return <Badge variant="outline"   className="gap-1 font-normal text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-500/40"><AlertCircle className="h-3 w-3" />Waiting</Badge>
      case 'Scheduled':        return <Badge variant="outline"   className="gap-1 font-normal"><Clock className="h-3 w-3" />Scheduled</Badge>
      default:                 return <Badge variant="secondary">{status}</Badge>
    }
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
      <RoleNotice />

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
          {syncableCount > 0 && (
            <Button
              variant="outline"
              onClick={refreshStats}
              disabled={isSyncing}
              size="sm"
              className="gap-1.5 bg-transparent"
              title={`Pull fresh download counts and stars for ${syncableCount} ${
                syncableCount === 1 ? 'entry' : 'entries'
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing…' : 'Refresh stats'}
            </Button>
          )}
          <Button variant="outline" onClick={exportToCSV} size="sm" className="gap-1.5 bg-transparent">
            <Download className="h-3.5 w-3.5" />Export CSV
          </Button>
          {can.create && (
            <Link href="/dashboard/add" data-tour="content-add">
              <Button size="sm" className="gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" />Add Entry
              </Button>
            </Link>
          )}
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
                  const Icon = CATEGORY_META[cat].icon
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
            const cat    = categoryOf(entry)
            const Icon   = CATEGORY_META[cat].icon

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
                        {entry.category === 'Demo' && (entry.stack || entry.repoUrl) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[entry.stack, entry.repoUrl].filter(Boolean).join(' · ')}
                          </p>
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
                      <span className="inline-flex items-center gap-1.5">
                        <PlatformIcon platform={entry.platform} size={13} />
                        {entry.platform}
                      </span>
                      <span>{entry.contentType}</span>
                      <span>
                        {new Date(entry.publicationDate).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                      <EntryMetric entry={entry} />
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

                    {(can.edit || can.delete) && (
                      <div className="flex items-center gap-2 pt-1">
                        {can.edit && (
                          <Link href={`/dashboard/edit/${entry._id}`}>
                            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs bg-transparent">
                              <Edit className="h-3 w-3" />Edit
                            </Button>
                          </Link>
                        )}
                        {can.create && (
                          <Button variant="outline" size="sm"
                            className="h-7 gap-1 text-xs bg-transparent"
                            onClick={() => handleDuplicate(entry._id)}>
                            <Copy className="h-3 w-3" />Duplicate
                          </Button>
                        )}
                        {can.delete && (
                          <Button variant="outline" size="sm"
                            className="h-7 gap-1 text-xs bg-transparent text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(entry._id)}>
                            <Trash2 className="h-3 w-3" />Delete
                          </Button>
                        )}
                      </div>
                    )}
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
