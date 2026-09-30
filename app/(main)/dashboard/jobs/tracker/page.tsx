'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { AlertTriangle, CalendarClock, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { JobsHeader } from '@/components/jobs/jobs-tabs'
import { Monogram } from '@/components/jobs/job-card'
import { COLUMNS, STAGES, columnOf, stageLabel } from '@/lib/jobs/stages'
import { trackerStats } from '@/lib/jobs/tracker'
import { timeAgo } from '@/lib/jobs/ui'

interface Application {
  _id: Id<'jobApplications'>
  title: string
  company: string
  url?: string
  location?: string
  stage: string
  notes?: string
  nextStep?: string
  nextStepAt?: number
  contact?: string
  salaryNote?: string
  history: { stage: string; at: number }[]
  updatedAt: number
  listing: { slug: string | null; status: string; lastVerifiedAt: number | null } | null
}

const DAY = 24 * 60 * 60 * 1000

function stageForColumn(column: string): string {
  return column === 'closed' ? 'rejected' : column
}

function toDateInput(value?: number): string {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

function pct(value: number | null): string {
  return value == null ? '-' : `${Math.round(value * 100)}%`
}

export default function TrackerPage() {
  const rows = useQuery(api.jobBoard.applications) as Application[] | null | undefined
  const setStage = useMutation(api.jobBoard.setStage)
  const [openId, setOpenId] = useState<Id<'jobApplications'> | null>(null)
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)

  const stats = useMemo(() => (rows ? trackerStats(rows) : null), [rows])
  const selected = rows?.find((row) => row._id === openId) ?? null

  const move = async (id: string, column: string) => {
    const row = rows?.find((item) => item._id === id)
    if (!row || columnOf(row.stage) === column) return
    try {
      await setStage({ id: id as Id<'jobApplications'>, stage: stageForColumn(column) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not move')
    }
  }

  return (
    <main className="px-6 py-8 lg:px-10 max-w-400">
      <RoleNotice />
      <JobsHeader
        title="Tracker"
        description="Every role you are chasing, from saved to signed. Drag cards between columns."
      >
        <Button data-tour="tracker-add" onClick={() => setAdding(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4" />
          Add a role
        </Button>
      </JobsHeader>

      {rows === undefined ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">Sign in to use the tracker.</p>
      ) : rows.length === 0 ? (
        <div data-tour="tracker-board" className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium text-foreground">Nothing tracked yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Save a role from the board, or add one you found elsewhere. Moving a card keeps a dated history, so
            you can see how long each company takes to reply.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/jobs">Browse roles</Link>
            </Button>
            <Button onClick={() => setAdding(true)}>Add a role</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {stats && (
            <div data-tour="tracker-stats" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Active" value={String(stats.active)} />
              <Stat label="Applied" value={String(stats.applied)} />
              <Stat label="Response rate" value={pct(stats.responseRate)} />
              <Stat label="Interview rate" value={pct(stats.interviewRate)} />
              <Stat
                label="Typical reply"
                value={stats.medianDaysToResponse == null ? '-' : `${stats.medianDaysToResponse}d`}
              />
              <Stat label="Offers" value={String(stats.offers)} />
            </div>
          )}

          {stats && (stats.needsFollowUp.length > 0 || stats.upcoming.length > 0) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {stats.upcoming.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="h-4 w-4 text-accent" />
                    Coming up
                  </p>
                  <ul className="space-y-1 text-sm">
                    {(stats.upcoming as unknown as Application[]).map((row) => (
                      <li key={row._id}>
                        <button type="button" onClick={() => setOpenId(row._id)} className="text-left hover:underline">
                          {new Date(row.nextStepAt ?? 0).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          {': '}
                          {row.nextStep || 'Next step'} at {row.company}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {stats.needsFollowUp.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 text-accent" />
                    Worth a nudge
                  </p>
                  <ul className="space-y-1 text-sm">
                    {(stats.needsFollowUp as unknown as Application[]).map((row) => (
                      <li key={row._id}>
                        <button type="button" onClick={() => setOpenId(row._id)} className="text-left hover:underline">
                          {row.company}, {row.title}
                          <span className="text-muted-foreground"> · quiet for {Math.floor((Date.now() - row.updatedAt) / DAY)} days</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div data-tour="tracker-board" className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
            {COLUMNS.map((column) => {
              const items = rows.filter((row) => columnOf(row.stage) === column.id)
              return (
                <section
                  key={column.id}
                  aria-label={column.label}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setOverColumn(column.id)
                  }}
                  onDragLeave={() => setOverColumn((current) => (current === column.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault()
                    setOverColumn(null)
                    const id = event.dataTransfer.getData('text/plain') || dragId
                    setDragId(null)
                    if (id) void move(id, column.id)
                  }}
                  className={`min-h-40 min-w-52 rounded-xl border bg-muted/40 p-2 transition-colors ${
                    overColumn === column.id ? 'border-accent bg-accent/5' : 'border-border'
                  }`}
                >
                  <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {column.label}
                    <span className="tabular-nums">{items.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {items.map((row, rowIndex) => (
                      <div key={row._id} data-tour={column.id === COLUMNS.find((c) => rows.some((r) => columnOf(r.stage) === c.id))?.id && rowIndex === 0 ? 'tracker-card' : undefined}>
                      <Card
                        row={row}
                        onOpen={() => setOpenId(row._id)}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', row._id)
                          event.dataTransfer.effectAllowed = 'move'
                          setDragId(row._id)
                        }}
                        onMove={(stage) => setStage({ id: row._id, stage })}
                      />
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      <AddDialog open={adding} onOpenChange={setAdding} />
      <Detail row={selected} onClose={() => setOpenId(null)} />
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function Card({
  row,
  onOpen,
  onDragStart,
  onMove,
}: {
  row: Application
  onOpen: () => void
  onDragStart: (event: React.DragEvent) => void
  onMove: (stage: string) => void
}) {
  const closed = row.listing && row.listing.status !== 'active'
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm active:cursor-grabbing"
    >
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 text-left">
        <Monogram name={row.company} size={28} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{row.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{row.company}</span>
        </span>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {closed && (
          <Badge variant="outline" className="text-[10px] font-normal">
            Listing closed
          </Badge>
        )}
        {row.nextStepAt ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {new Date(row.nextStepAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </Badge>
        ) : null}
        <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(row.updatedAt)}</span>
      </div>
      <label className="sr-only" htmlFor={`stage-${row._id}`}>
        Stage for {row.title}
      </label>
      <select
        id={`stage-${row._id}`}
        value={row.stage}
        onChange={(event) => onMove(event.target.value)}
        className="mt-2 h-7 w-full rounded border border-border bg-background px-1 text-xs md:hidden"
      >
        {STAGES.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const addManual = useMutation(api.jobBoard.addManual)
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [url, setUrl] = useState('')
  const [stage, setStage] = useState('applied')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await addManual({ title, company, url: url || undefined, stage })
      setTitle('')
      setCompany('')
      setUrl('')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a role</DialogTitle>
          <DialogDescription>For roles you found outside the board.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Role title" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Role title" />
          <Input placeholder="Company" value={company} onChange={(event) => setCompany(event.target.value)} aria-label="Company" />
          <Input placeholder="Link (https://)" value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Link" />
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            aria-label="Stage"
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {STAGES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || !title.trim() || !company.trim()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Detail({ row, onClose }: { row: Application | null; onClose: () => void }) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {row && <DetailBody key={row._id} row={row} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function DetailBody({ row, onClose }: { row: Application; onClose: () => void }) {
  const update = useMutation(api.jobBoard.updateApplication)
  const setStage = useMutation(api.jobBoard.setStage)
  const remove = useMutation(api.jobBoard.removeApplication)
  const [notes, setNotes] = useState(row.notes ?? '')
  const [nextStep, setNextStep] = useState(row.nextStep ?? '')
  const [nextDate, setNextDate] = useState(toDateInput(row.nextStepAt))
  const [contact, setContact] = useState(row.contact ?? '')
  const [salaryNote, setSalaryNote] = useState(row.salaryNote ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await update({
        id: row._id,
        notes,
        nextStep,
        nextStepAt: nextDate ? new Date(`${nextDate}T09:00:00`).getTime() : null,
        contact,
        salaryNote,
      })
      toast.success('Saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{row.title}</SheetTitle>
        <SheetDescription>
          {row.company}
          {row.location ? `, ${row.location}` : ''}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-6">
        {row.listing && row.listing.status !== 'active' && (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            This listing has been taken down by the company.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {row.listing?.slug && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/jobs/${row.listing.slug}`}>View listing</Link>
            </Button>
          )}
          {row.listing?.slug && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/jobs/kit/${row.listing.slug}`}>Tailor CV</Link>
            </Button>
          )}
          {row.url && (
            <Button asChild variant="outline" size="sm">
              <a href={row.url} target="_blank" rel="noopener noreferrer">
                Open link
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>

        <Field label="Stage">
          <select
            value={row.stage}
            onChange={(event) => setStage({ id: row._id, stage: event.target.value })}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Next step">
          <Input value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="Technical interview" />
        </Field>
        <Field label="Date">
          <Input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
        </Field>
        <Field label="Contact">
          <Input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Recruiter name or email" />
        </Field>
        <Field label="Pay discussed">
          <Input value={salaryNote} onChange={(event) => setSalaryNote(event.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea rows={6} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <div className="flex items-center justify-between">
          <Button onClick={save} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Save
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await remove({ id: row._id })
              onClose()
            }}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">History</p>
          <ol className="space-y-1 text-xs text-muted-foreground">
            {[...row.history].reverse().map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                {stageLabel(entry.stage)} · {new Date(entry.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
