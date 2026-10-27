'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Loader2, Plus, Undo2 } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { Doc } from '@/convex/_generated/dataModel'
import { useUserContext } from '@/contexts/user-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DISMISS_REASONS, canUndo, entryDraftProblems, type EntryDraft } from '@/lib/agents/proposals'
import { PLATFORMS_BY_CATEGORY } from '@/lib/types'

const PLATFORM_OPTIONS = Array.from(
  new Set([...PLATFORMS_BY_CATEGORY.Written, ...PLATFORMS_BY_CATEGORY.Video]),
)

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY: EntryDraft = { client: '', title: '', link: '', platform: '', publicationDate: today() }

type Proposal = Doc<'proposals'>

const STATUS_LABEL: Record<Proposal['status'], string> = {
  pending: 'Waiting',
  executed: 'Added',
  dismissed: 'Dismissed',
  stale: 'Out of date',
  undone: 'Undone',
  failed: 'Failed',
}

function errorText(err: unknown): string {
  const data = (err as { data?: unknown })?.data
  return typeof data === 'string' ? data : 'Something went wrong. Try again.'
}

export default function InboxPage() {
  const { profile } = useUserContext()
  const skip = profile?._id ? {} : 'skip'
  const proposals = useQuery(api.inbox.list, skip)
  const settings = useQuery(api.agentSettings.get, skip)
  const clients = useQuery(api.clients.getClients, skip)

  const create = useMutation(api.inbox.createManual)
  const approve = useMutation(api.inbox.approve)
  const dismiss = useMutation(api.inbox.dismiss)
  const undo = useMutation(api.inbox.undo)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<EntryDraft>(EMPTY)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<Proposal | null>(null)
  const [editDraft, setEditDraft] = useState<EntryDraft>(EMPTY)

  const role = settings?.role
  const canWrite = role === 'owner' || role === 'admin' || role === 'editor'
  const canUndoRole = role === 'owner' || role === 'admin'
  const pending = (proposals ?? []).filter((p) => p.status === 'pending')
  const history = (proposals ?? []).filter((p) => p.status !== 'pending')
  const clientOptions = (clients ?? []).filter((c) => !!c.slug)

  async function run(id: string, fn: () => Promise<unknown>, success: string) {
    setBusy(id)
    try {
      await fn()
      toast.success(success)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  async function submitNew() {
    const problems = entryDraftProblems(draft)
    if (problems.length) return toast.error(problems[0])
    setBusy('new')
    try {
      await create({ draft })
      toast.success('Added to your Inbox.')
      setDraft(EMPTY)
      setOpen(false)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  async function submitEdit() {
    if (!editing) return
    const problems = entryDraftProblems(editDraft)
    if (problems.length) return toast.error(problems[0])
    await run(editing._id, () => approve({ id: editing._id, draft: editDraft }), 'Added to Work.')
    setEditing(null)
  }

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[2.75rem]">
            Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Things waiting for a decision. Nothing here changes your Work until you approve it.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> New proposal
          </Button>
        )}
      </div>

      {proposals === undefined ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-10">
          <section aria-label="Waiting for you" className="space-y-3">
            <h2 className="text-sm font-semibold">Waiting for you ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="rounded-2xl bg-paper px-5 py-8 text-sm text-muted-foreground">
                The Inbox is empty. Add a proposal by hand, or wait for an agent to find something.
              </p>
            ) : (
              pending.map((p) => (
                <article key={p._id} className="rounded-2xl bg-paper p-5">
                  <p className="font-medium">{p.summary}</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {p.payload.link}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.source === 'person' ? 'Written by a person' : `Found by ${p.source}`} ·{' '}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                  {canWrite && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        disabled={busy === p._id}
                        onClick={() => run(p._id, () => approve({ id: p._id }), 'Added to Work.')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === p._id}
                        onClick={() => {
                          setEditing(p)
                          setEditDraft({ ...p.payload })
                        }}
                      >
                        Edit and approve
                      </Button>
                      <Select
                        onValueChange={(reason) =>
                          run(p._id, () => dismiss({ id: p._id, reason }), 'Dismissed.')
                        }
                      >
                        <SelectTrigger className="h-8 w-40 text-sm" aria-label="Dismiss with a reason">
                          <SelectValue placeholder="Dismiss…" />
                        </SelectTrigger>
                        <SelectContent>
                          {DISMISS_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>

          {history.length > 0 && (
            <section aria-label="History" className="space-y-3">
              <h2 className="text-sm font-semibold">History</h2>
              <ul className="divide-y divide-ink/10 rounded-2xl bg-paper">
                {history.map((p) => (
                  <li key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Badge variant="secondary">{STATUS_LABEL[p.status]}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.summary}</span>
                    {p.dismissReason && (
                      <span className="text-xs text-muted-foreground">{p.dismissReason}</span>
                    )}
                    {canUndo(p.status) && canUndoRole && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        disabled={busy === p._id}
                        onClick={() => run(p._id, () => undo({ id: p._id }), 'Undone. The entry is removed.')}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <DraftDialog
        open={open}
        onOpenChange={setOpen}
        title="New proposal"
        description="Write what you want added. It waits here until you approve it."
        draft={draft}
        setDraft={setDraft}
        clients={clientOptions}
        busy={busy === 'new'}
        action="Add to Inbox"
        onSubmit={submitNew}
      />
      <DraftDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit and approve"
        description="Change what you need. Approving adds the entry to Work."
        draft={editDraft}
        setDraft={setEditDraft}
        clients={clientOptions}
        busy={!!editing && busy === editing._id}
        action="Approve"
        onSubmit={submitEdit}
      />
    </main>
  )
}

function DraftDialog({
  open, onOpenChange, title, description, draft, setDraft, clients, busy, action, onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  draft: EntryDraft
  setDraft: (draft: EntryDraft) => void
  clients: { _id: string; slug?: string; company?: string; name: string }[]
  busy: boolean
  action: string
  onSubmit: () => void
}) {
  const set = (patch: Partial<EntryDraft>) => setDraft({ ...draft, ...patch })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-title">Title</Label>
            <Input id="p-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-link">Link</Label>
            <Input
              id="p-link"
              inputMode="url"
              placeholder="https://"
              value={draft.link}
              onChange={(e) => set({ link: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Program</Label>
              <Select value={draft.client} onValueChange={(client) => set({ client })}>
                <SelectTrigger><SelectValue placeholder="Choose a program" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c._id} value={c.slug!}>{c.company || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={draft.platform} onValueChange={(platform) => set({ platform })}>
                <SelectTrigger><SelectValue placeholder="Choose a platform" /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-date">Publication date</Label>
            <Input
              id="p-date"
              type="date"
              value={draft.publicationDate}
              onChange={(e) => set({ publicationDate: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
