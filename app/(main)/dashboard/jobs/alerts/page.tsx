'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'
import { Bell, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { JobsHeader } from '@/components/jobs/jobs-tabs'
import { REGIONS } from '@/lib/jobs/locations'
import { FAMILIES, SENIORITIES } from '@/lib/jobs/taxonomy'

const WORKPLACES = ['remote', 'hybrid', 'onsite']

function csv(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

function describe(alert: {
  query?: string
  families: string[]
  seniority: string[]
  workplaces: string[]
  regions: string[]
  minSalaryUsd?: number
}): string {
  const parts = [
    alert.query ? `"${alert.query}"` : null,
    alert.families.length ? alert.families.join(', ') : null,
    alert.seniority.length ? alert.seniority.join(', ') : null,
    alert.workplaces.length ? alert.workplaces.join(', ') : null,
    alert.regions.length ? alert.regions.join(', ') : null,
    alert.minSalaryUsd ? `from $${alert.minSalaryUsd.toLocaleString()}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Every new role'
}

function AlertsInner() {
  const params = useSearchParams()
  const alerts = useQuery(api.jobAlerts.list)
  const pro = useQuery(api.jobPro.status)?.pro === true
  const create = useMutation(api.jobAlerts.create)
  const update = useMutation(api.jobAlerts.update)
  const remove = useMutation(api.jobAlerts.remove)

  const [name, setName] = useState('')
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [families, setFamilies] = useState<string[]>(csv(params.get('f')))
  const [seniority, setSeniority] = useState<string[]>(csv(params.get('s')))
  const [workplaces, setWorkplaces] = useState<string[]>(csv(params.get('w')))
  const [regions, setRegions] = useState<string[]>(csv(params.get('r')))
  const [min, setMin] = useState(params.get('min') ?? '')
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly'>('daily')
  const [busy, setBusy] = useState(false)

  const toggle = (list: string[], set: (next: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])

  const submit = async () => {
    setBusy(true)
    try {
      await create({
        name: name.trim() || 'My alert',
        query: query.trim() || undefined,
        families,
        seniority,
        workplaces,
        regions,
        minSalaryUsd: min ? Number(min) : undefined,
        frequency,
      })
      setName('')
      toast.success('Alert created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create')
    } finally {
      setBusy(false)
    }
  }

  const chips = (
    items: { id: string; label: string }[],
    list: string[],
    set: (next: string[]) => void,
  ) => (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={list.includes(item.id)}
          onClick={() => toggle(list, set, item.id)}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            list.includes(item.id)
              ? 'border-foreground/25 bg-secondary text-foreground'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )

  return (
    <main className="px-6 py-8 lg:px-10 max-w-400">
      <RoleNotice />
      <JobsHeader
        title="Alerts"
        description="An email with new matching roles, only when there are some."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">New alert</h2>
          <Input placeholder="Name, for example Senior advocate, remote" value={name} onChange={(e) => setName(e.target.value)} aria-label="Alert name" maxLength={80} />
          <Input placeholder="Keywords (optional)" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Keywords" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Focus</p>
            {chips(FAMILIES.map((f) => ({ id: f.id, label: f.label })), families, setFamilies)}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Level</p>
            {chips(SENIORITIES.map((s) => ({ id: s.id, label: s.label })), seniority, setSeniority)}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Workplace</p>
            {chips(WORKPLACES.map((w) => ({ id: w, label: w })), workplaces, setWorkplaces)}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Region</p>
            {chips(REGIONS.map((r) => ({ id: r.id, label: r.label })), regions, setRegions)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input inputMode="numeric" placeholder="Minimum yearly pay in USD" value={min} onChange={(e) => setMin(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Minimum pay" />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'instant' | 'daily' | 'weekly')}
              aria-label="Frequency"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {pro ? (
                <option value="instant">Instant, as soon as a role is posted</option>
              ) : (
                <option value="instant" disabled>
                  Instant (Jobs Pro)
                </option>
              )}
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <Button onClick={submit} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Create alert
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium text-foreground">Your alerts</h2>
          {alerts === undefined ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          ) : !alerts || alerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-5 w-5" />
              No alerts yet. Set filters on the{' '}
              <Link href="/dashboard/jobs" className="underline">
                board
              </Link>{' '}
              and start one here.
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert._id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{alert.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{describe(alert)}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.frequency === 'instant' ? 'Instant' : alert.frequency === 'daily' ? 'Daily' : 'Weekly'}
                    {alert.lastSentAt ? ` · last sent ${new Date(alert.lastSentAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <Switch
                  checked={alert.enabled}
                  onCheckedChange={(enabled) => update({ id: alert._id, enabled })}
                  aria-label={`${alert.name} enabled`}
                />
                <Button variant="ghost" size="icon" onClick={() => remove({ id: alert._id })} aria-label={`Delete ${alert.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

export default function AlertsPage() {
  return (
    <Suspense fallback={null}>
      <AlertsInner />
    </Suspense>
  )
}
