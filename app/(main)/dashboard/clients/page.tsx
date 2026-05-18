'use client'

import { useState, useRef } from 'react'
import { useUserContext } from '@/contexts/user-context'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id, Doc } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { toast } from 'sonner'
import {
  Plus, MoreVertical, Building2, Mail, Globe,
  DollarSign, Calendar, FileText, Loader2, Users,
  TrendingUp, Edit3, Trash2, ExternalLink,
} from 'lucide-react'
import { AdminTour, AdminTourTriggerButton, TourVariant } from '@/components/admin-onboarding-tour'

// ── Types ─────────────────────────────────────────────────────────────────────

type ClientStatus   = 'Active' | 'Paused' | 'Ended'
type ContractType   = 'Retainer' | 'Project' | 'Hourly'
type Currency       = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'CAD' | 'AUD'

interface ClientFormData {
  name: string
  company: string
  email: string
  website: string
  monthlyRetainer: string
  currency: Currency
  startDate: string
  endDate: string
  status: ClientStatus
  contractType: ContractType | ''
  notes: string
  slug: string
}

const EMPTY_FORM: ClientFormData = {
  name: '', company: '', email: '', website: '',
  monthlyRetainer: '', currency: 'USD',
  startDate: '', endDate: '',
  status: 'Active', contractType: '', notes: '', slug: '',
}

const STATUS_STYLES: Record<ClientStatus, string> = {
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Paused: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Ended:  'bg-muted text-muted-foreground border-border',
}

const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD']

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$', EUR: '€', GBP: '£', NGN: '₦', CAD: 'CA$', AUD: 'A$',
}

function avatarColor(name: string) {
  const colors = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-teal-100 text-teal-700',
    'bg-rose-100 text-rose-700',
    'bg-orange-100 text-orange-700',
    'bg-indigo-100 text-indigo-700',
  ]
  return colors[name.charCodeAt(0) % colors.length]
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function autoSlug(company: string) {
  return company.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── Client form dialog ────────────────────────────────────────────────────────

function ClientFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  isSaving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: ClientFormData
  onSave: (data: ClientFormData) => Promise<void>
  isSaving: boolean
}) {
  const [form, setForm] = useState<ClientFormData>(initial)
  const slugTouched = useRef(false)

  const set = (field: keyof ClientFormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'company' && !slugTouched.current) {
        next.slug = autoSlug(value)
      }
      if (field === 'slug') slugTouched.current = true
      return next
    })
  }

  // Reset when dialog opens with new initial data
  useState(() => { setForm(initial); slugTouched.current = false })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Client name is required'); return }
    await onSave(form)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.name ? 'Edit Client' : 'Add a New Client'}</DialogTitle>
          <DialogDescription>
            {initial.name
              ? 'Update the details for this client engagement.'
              : 'Fill in the details for your new client. Only the name is required.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">

          {/* Name + Company */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Contact name <span className="text-destructive">*</span></Label>
              <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Doe" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Acme Corp" />
            </div>
          </div>

          {/* Email + Website */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://acme.com" />
            </div>
          </div>

          <Separator />

          {/* Contract */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="contractType">Contract type</Label>
              <Select value={form.contractType} onValueChange={(v) => set('contractType', v)}>
                <SelectTrigger id="contractType"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retainer">Retainer</SelectItem>
                  <SelectItem value="Project">Project</SelectItem>
                  <SelectItem value="Hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v as Currency)}>
                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retainer">Monthly retainer</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {CURRENCY_SYMBOL[form.currency]}
                </span>
                <Input
                  id="retainer"
                  type="number"
                  min="0"
                  step="1"
                  value={form.monthlyRetainer}
                  onChange={(e) => set('monthlyRetainer', e.target.value)}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          {/* Dates + Status */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="endDate" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as ClientStatus)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Paused">Paused</SelectItem>
                  <SelectItem value="Ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug">Dashboard slug</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">devrel.studio/</span>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => { set('slug', e.target.value); slugTouched.current = true }}
                placeholder="acme-corp"
                className="pl-[108px] font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">This becomes the client&apos;s live dashboard URL and the identifier used in content entries.</p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Scope of work, key contacts, goals..."
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {initial.name ? 'Save changes' : 'Add client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { profile } = useUserContext()
  const userId = profile?._id

  const clients = useQuery(api.clients.getClients, userId ? { userId } : 'skip')
  const createClient = useMutation(api.clients.createClient)
  const updateClient = useMutation(api.clients.updateClient)
  const deleteClient = useMutation(api.clients.deleteClient)

  const [dialogOpen,  setDialogOpen]  = useState(false)
  const [deleteId,    setDeleteId]    = useState<Id<'clients'> | null>(null)
  const [editTarget,  setEditTarget]  = useState<Doc<'clients'> | null>(null)
  const [isSaving,    setIsSaving]    = useState(false)
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null)

  const activeClients  = clients?.filter((c) => c.status === 'Active') ?? []
  const totalRetainer  = activeClients.reduce((sum, c) => sum + (c.monthlyRetainer ?? 0), 0)
  const avgRetainer    = activeClients.length ? Math.round(totalRetainer / activeClients.length) : 0
  const sym            = (currency: string) => CURRENCY_SYMBOL[currency as Currency] ?? '$'

  const openAdd  = () => { setEditTarget(null); setDialogOpen(true) }
  const openEdit = (client: Doc<'clients'>) => { setEditTarget(client); setDialogOpen(true) }

  const handleSave = async (data: ClientFormData) => {
    if (!userId) return
    setIsSaving(true)
    try {
      if (editTarget) {
        await updateClient({
          clientId: editTarget._id,
          name: data.name,
          company: data.company,
          email: data.email || undefined,
          website: data.website || undefined,
          monthlyRetainer: data.monthlyRetainer ? Number(data.monthlyRetainer) : undefined,
          currency: data.currency,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
          status: data.status,
          contractType: (data.contractType || undefined) as ContractType | undefined,
          notes: data.notes || undefined,
          slug: data.slug || undefined,
        })
        toast.success('Client updated')
      } else {
        await createClient({
          userId,
          name: data.name,
          company: data.company,
          email: data.email || undefined,
          website: data.website || undefined,
          monthlyRetainer: data.monthlyRetainer ? Number(data.monthlyRetainer) : undefined,
          currency: data.currency,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
          status: data.status,
          contractType: (data.contractType || undefined) as ContractType | undefined,
          notes: data.notes || undefined,
          slug: data.slug || undefined,
        })
        toast.success('Client added')
      }
      setDialogOpen(false)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteClient({ clientId: deleteId })
      toast.success('Client removed')
    } catch {
      toast.error('Failed to delete client')
    } finally {
      setDeleteId(null)
    }
  }

  const formInitial: ClientFormData = editTarget
    ? {
        name: editTarget.name,
        company: editTarget.company,
        email: editTarget.email ?? '',
        website: editTarget.website ?? '',
        monthlyRetainer: editTarget.monthlyRetainer?.toString() ?? '',
        currency: (editTarget.currency as Currency) ?? 'USD',
        startDate: editTarget.startDate ?? '',
        endDate: editTarget.endDate ?? '',
        status: editTarget.status as ClientStatus,
        contractType: (editTarget.contractType ?? '') as ContractType | '',
        notes: editTarget.notes ?? '',
        slug: editTarget.slug ?? '',
      }
    : EMPTY_FORM

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">

      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your client engagements, retainers, and contact details.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AdminTourTriggerButton onStartTour={() => tourControls?.startTour()} />
          <Button
            onClick={openAdd}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            data-tour="clients-add"
          >
            <Plus className="h-4 w-4" />
            Add client
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" data-tour="clients-stats">
        {[
          { label: 'Active clients',      value: activeClients.length,  icon: Users,      suffix: '' },
          { label: 'Monthly retainer',    value: totalRetainer,         icon: DollarSign, prefix: '$', suffix: '/mo' },
          { label: 'Average retainer',    value: avgRetainer,           icon: TrendingUp, prefix: '$', suffix: '/mo' },
        ].map(({ label, value, icon: Icon, prefix = '', suffix }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{prefix}{value.toLocaleString()}{suffix}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client list */}
      {clients === undefined ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No clients yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-5">
              Add your first client to start tracking retainers, start dates, and engagement details.
            </p>
            <Button onClick={openAdd} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4" /> Add your first client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-tour="clients-list">
          {clients.map((client) => (
            <Card key={client._id} className="group relative flex flex-col hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col gap-4 flex-1">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(client.name)}`}>
                      {initials(client.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                      {client.company && (
                        <p className="text-xs text-muted-foreground truncate">{client.company}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs border ${STATUS_STYLES[client.status as ClientStatus]}`}>
                      {client.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100" aria-label="Client options">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(client)}>
                          <Edit3 className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(client._id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-muted-foreground">
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <a href={client.website} target="_blank" rel="noreferrer" className="truncate hover:text-accent transition-colors">{client.website.replace(/^https?:\/\//, '')}</a>
                    </div>
                  )}
                  {client.startDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Since {formatDate(client.startDate)}</span>
                    </div>
                  )}
                  {client.notes && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <p className="line-clamp-2">{client.notes}</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-3">
                  <div>
                    {client.monthlyRetainer ? (
                      <p className="text-sm font-semibold text-foreground">
                        {sym(client.currency ?? 'USD')}{client.monthlyRetainer.toLocaleString()}
                        <span className="text-xs text-muted-foreground font-normal">/mo</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No retainer set</p>
                    )}
                    {client.contractType && (
                      <p className="text-xs text-muted-foreground">{client.contractType}</p>
                    )}
                  </div>
                  {client.slug ? (
                    <a
                      href={`/${client.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View dashboard
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={formInitial}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client record. Content entries linked to this client won&apos;t be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tour */}
      <AdminTour
        variant={'clients' as TourVariant}
        autoStart
        onTourControlReady={setTourControls}
      />
    </main>
  )
}
