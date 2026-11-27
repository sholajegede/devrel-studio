'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Circle, FileUp, Loader2 } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useWorkspaceRole } from '@/hooks/use-workspace-role'
import { useClientScope } from '@/contexts/client-scope'
import { RoleNotice } from '@/components/dashboard/role-notice'
import PageLoader from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_TYPES,
  isMonthKey,
  monthKey,
  monthLabel,
  previousMonth,
} from '@/lib/platform-stats'

// The Dev.to, Medium and Hashnode numbers a client cannot see, one card per
// client and platform, each with the screenshot or export it came from.

type Row = {
  _id: string
  client: string
  platform: string
  views?: number
  reads?: number
  note?: string
  evidenceStorageId?: string
  evidenceName?: string
  evidenceUrl: string | null
}

function lastTwelveMonths(): string[] {
  const months: string[] = []
  let month = monthKey(new Date())
  for (let i = 0; i < 12; i++) {
    months.push(month)
    month = previousMonth(month)
  }
  return months
}

function PlatformCard({
  client,
  platform,
  month,
  row,
  canEdit,
}: {
  client: string
  platform: string
  month: string
  row: Row | undefined
  canEdit: boolean
}) {
  const save = useMutation(api.platformStats.save)
  const uploadUrl = useMutation(api.platformStats.generateUploadUrl)
  const fileInput = useRef<HTMLInputElement>(null)

  const [views, setViews] = useState(row?.views?.toString() ?? '')
  const [reads, setReads] = useState(row?.reads?.toString() ?? '')
  const [note, setNote] = useState(row?.note ?? '')
  const [busy, setBusy] = useState(false)

  // A different month or a save elsewhere brings new values.
  useEffect(() => {
    setViews(row?.views?.toString() ?? '')
    setReads(row?.reads?.toString() ?? '')
    setNote(row?.note ?? '')
  }, [row?.views, row?.reads, row?.note, month])

  const numberOrUndefined = (value: string) => (value.trim() === '' ? undefined : Number(value))

  const submit = async (file?: File) => {
    setBusy(true)
    try {
      let evidenceStorageId: Id<'_storage'> | undefined
      if (file) {
        if (file.size > EVIDENCE_MAX_BYTES) throw new ConvexError('Files up to 8 MB.')
        const url = await uploadUrl()
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
        if (!response.ok) throw new ConvexError('The upload failed. Try again.')
        evidenceStorageId = ((await response.json()) as { storageId: Id<'_storage'> }).storageId
      }
      await save({
        client,
        platform,
        month,
        views: numberOrUndefined(views),
        reads: numberOrUndefined(reads),
        note: note || undefined,
        evidenceStorageId,
        evidenceName: file?.name,
      })
      toast.success(file ? `${platform} evidence saved` : `${platform} numbers saved`)
    } catch (error) {
      toast.error(error instanceof ConvexError ? String(error.data) : 'Could not save')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const done = !!row?.evidenceStorageId

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          {done ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Evidence uploaded" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" aria-label="No evidence yet" />
          )}
          {platform}
        </span>
        {row?.evidenceUrl ? (
          <a href={row.evidenceUrl} target="_blank" rel="noreferrer" className="max-w-48 truncate text-xs text-muted-foreground underline">
            {row.evidenceName ?? 'View file'}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Not provided</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Views</Label>
          <Input type="number" min={0} value={views} disabled={!canEdit} onChange={(e) => setViews(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{platform === 'Medium' ? 'Reads' : 'Reactions'}</Label>
          <Input type="number" min={0} value={reads} disabled={!canEdit} onChange={(e) => setReads(e.target.value)} />
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <Label className="text-xs">Note</Label>
        <Input value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </div>

      {canEdit && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="bg-transparent" disabled={busy} onClick={() => submit()}>
            Save numbers
          </Button>
          <Button size="sm" disabled={busy} onClick={() => fileInput.current?.click()} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            {done ? 'Replace file' : 'Upload screenshot'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={EVIDENCE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) submit(file)
            }}
          />
        </div>
      )}
    </div>
  )
}

export default function PlatformStatsPage() {
  const { can } = useWorkspaceRole()
  const { matches } = useClientScope()
  const months = useMemo(lastTwelveMonths, [])

  // Default to last month: the month that has closed and goes in the report.
  const [month, setMonth] = useState(() => previousMonth(monthKey(new Date())))
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('month')
    if (fromUrl && isMonthKey(fromUrl)) setMonth(fromUrl)
  }, [])

  const clients = useQuery(api.clients.getClients)
  const platforms = useQuery(api.platformStats.platformsByClient)
  const rows = useQuery(api.platformStats.list, { month }) as Row[] | undefined

  if (clients === undefined || platforms === undefined || rows === undefined) return <PageLoader />

  const visible = clients.filter((client) => client.slug && platforms[client.slug] && matches(client.slug))

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">
      <RoleNotice />

      <Link href="/dashboard/reports" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />Reports
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[2.75rem]">Platform stats</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Your clients can&apos;t see your Dev.to, Medium or Hashnode dashboards, so each month&apos;s
            report carries the numbers and the screenshot or export they came from.
          </p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            None of your clients has work on Dev.to, Medium or Hashnode yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {visible.map((client) => (
            <Card key={client._id}>
              <CardContent className="pt-5">
                <h2 className="mb-4 text-base font-medium">{client.company || client.name}</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {platforms[client.slug!].map((platform) => (
                    <PlatformCard
                      key={`${platform}-${month}`}
                      client={client.slug!}
                      platform={platform}
                      month={month}
                      row={rows.find((row) => row.client === client.slug && row.platform === platform)}
                      canEdit={can.edit}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
