'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { useUserContext } from '@/contexts/user-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { PROVIDERS, PROVIDER_LABEL, type Provider } from '@/lib/agents/sources'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ACTION_CLASSES, PRESETS, PRESET_COPY, ceilingFor, resolveLevel, isPreset,
  type Level, type Preset,
} from '@/lib/agents/autonomy'

const LEVEL_LABEL: Record<Level, string> = {
  ask: 'Ask — you do it',
  approve: 'Approve — one click',
  auto: 'Auto — log it',
}
const RANK: Level[] = ['ask', 'approve', 'auto']

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:gap-10">
      <div className="pt-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

function errorText(err: unknown): string {
  const data = (err as { data?: unknown })?.data
  return typeof data === 'string' ? data : 'Something went wrong. Try again.'
}

export default function AgentsPage() {
  const { profile } = useUserContext()
  const skip = profile?._id ? {} : 'skip'
  const settings = useQuery(api.agentSettings.get, skip)
  const activity = useQuery(api.inbox.activity, skip)
  const save = useMutation(api.agentSettings.save)
  const connections = useQuery(api.connections.list, skip)
  const clients = useQuery(api.clients.getClients, skip)
  const addConnection = useMutation(api.connections.add)
  const syncNow = useMutation(api.connections.syncNow)
  const removeConnection = useMutation(api.connections.remove)
  const [provider, setProvider] = useState<Provider>('devto')
  const [handle, setHandle] = useState('')
  const [program, setProgram] = useState('')
  const [adding, setAdding] = useState(false)

  const [preset, setPreset] = useState<Preset>('careful')
  const [overrides, setOverrides] = useState<Record<string, Level>>({})
  const [paused, setPaused] = useState(false)
  const [budget, setBudget] = useState('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setPreset(isPreset(settings.preset) ? settings.preset : 'careful')
    setOverrides(settings.overrides as Record<string, Level>)
    setPaused(settings.paused)
    setBudget(String(settings.monthlyBudgetUsd))
  }, [settings])

  const canEdit = settings?.role === 'owner' || settings?.role === 'admin'

  async function onAdd() {
    setAdding(true)
    try {
      await addConnection({ provider, handle, clientSlug: program })
      toast.success('Connected. Scout is reading it now. New posts appear in the Inbox.')
      setHandle('')
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setAdding(false)
    }
  }

  async function onSave() {
    setSaving(true)
    try {
      await save({ preset, overrides, paused, monthlyBudgetUsd: Number(budget) })
      toast.success('Saved.')
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">
      <div className="mb-8">
        <h1 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[2.75rem]">
          Agents
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Decide what agents may do alone and what needs you. Limits are enforced on the server.
        </p>
      </div>

      {settings === undefined ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-10">
          {!canEdit && (
            <p className="rounded-2xl bg-paper px-5 py-4 text-sm text-muted-foreground">
              Only an owner or admin can change these settings.
            </p>
          )}

          <Section title="Sources" description="Scout reads your public posts and sends new ones to the Inbox. It reads only. It never posts.">
            <div className="space-y-4">
              {connections === undefined ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : connections.length > 0 ? (
                <ul className="divide-y divide-ink/10 rounded-2xl bg-paper">
                  {connections.map((c) => (
                    <li key={c._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{PROVIDER_LABEL[c.provider]} · {c.handle}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.status === 'syncing' || c.status === 'new'
                            ? 'Reading…'
                            : c.status === 'error'
                              ? `Last read failed: ${c.lastError ?? 'unknown error'}`
                              : `${c.itemsRead ?? 0} posts read · ${c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : ''}`}
                        </p>
                      </div>
                      <Badge variant={c.status === 'error' ? 'destructive' : 'secondary'}>
                        {c.status === 'error' ? 'Needs attention' : c.status === 'ok' ? 'Healthy' : 'Reading'}
                      </Badge>
                      <Button size="sm" variant="ghost" aria-label="Read now" onClick={() => syncNow({ id: c._id }).catch((e) => toast.error(errorText(e)))}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      {canEdit && (
                        <Button size="sm" variant="ghost" aria-label="Disconnect" onClick={() => removeConnection({ id: c._id }).then(() => toast.success('Disconnected.')).catch((e) => toast.error(errorText(e)))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl bg-paper px-5 py-6 text-sm text-muted-foreground">No sources yet.</p>
              )}

              {settings?.role !== 'viewer' && (
                <div className="grid gap-3 rounded-2xl bg-paper p-5 sm:grid-cols-[140px_1fr_180px_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Platform</Label>
                    <Select value={provider} onValueChange={(p) => setProvider(p as Provider)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((p) => <SelectItem key={p} value={p}>{PROVIDER_LABEL[p]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="handle">{provider === 'devto' ? 'Username' : 'Blog address'}</Label>
                    <Input id="handle" value={handle} placeholder={provider === 'devto' ? 'shola' : 'name.hashnode.dev'} onChange={(e) => setHandle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Program</Label>
                    <Select value={program} onValueChange={setProgram}>
                      <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                      <SelectContent>
                        {(clients ?? []).filter((c) => !!c.slug).map((c) => (
                          <SelectItem key={c._id} value={c.slug!}>{c.company || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={onAdd} disabled={adding || !handle.trim() || !program}>
                    {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Connect
                  </Button>
                </div>
              )}
            </div>
          </Section>

          <Section title="Kill switch" description="Stops every agent at once. People can still use the app.">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-paper px-5 py-4">
              <div>
                <p className="text-sm font-medium">{paused ? 'Agents are paused' : 'Agents are on'}</p>
                <p className="text-sm text-muted-foreground">
                  {paused ? 'No agent runs until you turn this off.' : 'Agents follow the levels below.'}
                </p>
              </div>
              <Switch checked={paused} onCheckedChange={setPaused} disabled={!canEdit} aria-label="Pause all agents" />
            </div>
          </Section>

          <Section title="Autonomy" description="Pick a starting point. Then change single actions if you want.">
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => { setPreset(p); setOverrides({}) }}
                    aria-pressed={preset === p}
                    className={`rounded-2xl p-4 text-left transition-colors ${
                      preset === p ? 'bg-ink text-paper' : 'bg-paper hover:bg-sand'
                    }`}
                  >
                    <span className="block text-sm font-medium">{PRESET_COPY[p].label}</span>
                    <span className="mt-1 block text-sm opacity-80">{PRESET_COPY[p].description}</span>
                  </button>
                ))}
              </div>

              <ul className="divide-y divide-ink/10 rounded-2xl bg-paper">
                {ACTION_CLASSES.map((cls) => {
                  const level = resolveLevel(cls.key, preset, overrides[cls.key])
                  const ceiling = ceilingFor(cls)
                  const choices = RANK.filter((l) => RANK.indexOf(l) <= RANK.indexOf(ceiling))
                  return (
                    <li key={cls.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {cls.label}
                          {!cls.available && <Badge variant="secondary" className="ml-2">Phase {cls.phase}</Badge>}
                        </p>
                        <p className="text-sm text-muted-foreground">{cls.description}</p>
                        {cls.note && <p className="mt-1 text-xs text-muted-foreground">{cls.note}</p>}
                      </div>
                      <Select
                        value={level}
                        disabled={!canEdit || choices.length < 2}
                        onValueChange={(v) => setOverrides({ ...overrides, [cls.key]: v as Level })}
                      >
                        <SelectTrigger className="w-full sm:w-52" aria-label={`Level for ${cls.label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {choices.map((l) => (
                            <SelectItem key={l} value={l}>{LEVEL_LABEL[l]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  )
                })}
              </ul>
            </div>
          </Section>

          <Section title="Monthly budget" description="The most agents may spend on model use in one month, in US dollars. 0 means agents spend nothing.">
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="budget">US dollars per month</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                value={budget}
                disabled={!canEdit}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </Section>

          {canEdit && (
            <Button onClick={onSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </Button>
          )}

          <Section title="Activity" description="Everything people and agents did here, newest first. It cannot be edited.">
            {activity === undefined ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : activity.length === 0 ? (
              <p className="rounded-2xl bg-paper px-5 py-6 text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-ink/10 rounded-2xl bg-paper">
                {activity.map((e) => (
                  <li key={e._id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                    <span className="min-w-0 flex-1 text-sm">{e.summary}</span>
                    <span className="text-xs text-muted-foreground">
                      {e.actorLabel} · {new Date(e.at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </main>
  )
}
