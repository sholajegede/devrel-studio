'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { timeAgo } from '@/lib/jobs/ui'

// The job board's feeds: what was fetched, what broke, and what people click.

export default function AdminJobsPage() {
  const data = useQuery(api.adminJobs.overview)
  const seed = useMutation(api.adminJobs.seed)
  const syncNow = useMutation(api.adminJobs.syncNow)
  const refreshStats = useMutation(api.adminJobs.refreshStatsNow)
  const setActive = useMutation(api.adminJobs.setActive)
  const addSource = useMutation(api.adminJobs.addSource)
  const proRequests = useQuery(api.adminJobs.proRequests)
  const grantPro = useMutation(api.adminJobs.grantPro)
  const declinePro = useMutation(api.adminJobs.declinePro)

  const [kind, setKind] = useState<'greenhouse' | 'ashby' | 'lever' | 'remoteok' | 'wwr' | 'hn' | 'reddit' | 'page'>('greenhouse')
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')

  const run = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action()
      toast.success(label)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed')
    }
  }

  if (data === undefined) return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  if (data === null) return <p className="text-sm text-muted-foreground">Not available.</p>

  const failing = data.sources.filter((source) => source.lastOk === false).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {data.activeJobs} live roles from {data.sources.length} feeds, {data.clicks} apply clicks
            {failing ? `, ${failing} feeds failing` : ''}. Feeds sync three times a day.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => run('Seeded and syncing', () => seed({}))}>
            Seed feeds
          </Button>
          <Button variant="outline" onClick={() => run('Sync started', () => syncNow({}))}>
            Sync all now
          </Button>
          <Button variant="outline" onClick={() => run('Stats refreshing', () => refreshStats({}))}>
            Refresh stats
          </Button>
        </div>
      </div>

      {proRequests && proRequests.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium">Jobs Pro requests</p>
          <ul className="space-y-2 text-sm">
            {proRequests.map((request) => (
              <li key={request._id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {request.name ? `${request.name}, ` : ''}
                  {request.email}: {request.amount.toLocaleString('en-US')} {request.currency} for {request.months} months
                </span>
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => run('Pass opened', () => grantPro({ requestId: request._id }))}>
                    Payment received, grant
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => run('Declined', () => declinePro({ requestId: request._id }))}>
                    Decline
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium">Add a feed</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            aria-label="Board type"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="greenhouse">Greenhouse</option>
            <option value="ashby">Ashby</option>
            <option value="lever">Lever</option>
            <option value="remoteok">RemoteOK tag</option>
            <option value="wwr">We Work Remotely feed</option>
            <option value="hn">Hacker News (hiring or freelancer)</option>
            <option value="reddit">Reddit subreddit</option>
            <option value="page">Careers page (registered in lib/jobs/pages.ts)</option>
          </select>
          <Input className="w-48" placeholder="board slug" value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Board slug" />
          <Input className="w-48" placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Company name" />
          <Button
            disabled={!slug.trim() || !name.trim()}
            onClick={() =>
              run('Feed added', async () => {
                await addSource({ kind, slug, name })
                setSlug('')
                setName('')
              })
            }
          >
            Add
          </Button>
        </div>
      </Card>

      {data.topClicked.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Most clicked</p>
          <ul className="space-y-1 text-sm">
            {data.topClicked.map((job) => (
              <li key={job.slug} className="flex justify-between gap-3">
                <a href={`/jobs/${job.slug}`} className="truncate hover:underline">
                  {job.title}, {job.company}
                </a>
                <span className="tabular-nums text-muted-foreground">{job.clicks}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Company</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Fetched</th>
              <th className="p-3 font-medium">Relevant</th>
              <th className="p-3 font-medium">Last sync</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {data.sources.map((source) => (
              <tr key={source._id} className="border-t border-border">
                <td className="p-3">{source.name}</td>
                <td className="p-3 text-muted-foreground">{source.kind}</td>
                <td className="p-3 tabular-nums">{source.totalFetched ?? '-'}</td>
                <td className="p-3 tabular-nums">{source.relevantCount ?? '-'}</td>
                <td className="p-3 text-muted-foreground">
                  {source.lastSyncedAt ? timeAgo(source.lastSyncedAt) : 'never'}
                </td>
                <td className="p-3">
                  {!source.active ? (
                    <span className="text-muted-foreground">Paused</span>
                  ) : source.lastOk === false ? (
                    <span className="text-destructive" title={source.lastError ?? ''}>
                      Failing ({source.failures})
                    </span>
                  ) : (
                    'OK'
                  )}
                </td>
                <td className="flex gap-1 p-3">
                  <Button size="sm" variant="ghost" onClick={() => run('Sync started', () => syncNow({ sourceId: source._id }))}>
                    Sync
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(source.active ? 'Paused' : 'Resumed', () => setActive({ sourceId: source._id, active: !source.active }))}
                  >
                    {source.active ? 'Pause' : 'Resume'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
