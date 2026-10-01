'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { COUNTRY_OPTIONS } from '@/lib/jobs/locations'
import { FAMILIES, SENIORITIES } from '@/lib/jobs/taxonomy'
import { AVAILABILITY, ENGAGEMENTS, WORK_MODES, type TalentInput } from '@/lib/hire/talent'

const EMPTY: TalentInput = { workModes: [], engagements: [], families: [], skills: [], languages: [], experience: [], education: [], projects: [], communities: [] }
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message.replace(/^[\s\S]*Uncaught ConvexError: /, '').split('\n')[0] : fallback

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function Tags({ values, onChange, placeholder }: { values: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')
  const add = () => {
    const clean = input.trim()
    if (clean && !values.some((value) => value.toLowerCase() === clean.toLowerCase())) onChange([...values, clean])
    setInput('')
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
            {value}
            <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        placeholder={placeholder}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add() } }}
        onBlur={add}
      />
    </div>
  )
}

function Choice({ options, values, onChange }: { options: readonly string[]; values: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = values.includes(option)
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((item) => item !== option) : [...values, option])}
            className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            {cap(option)}
          </button>
        )
      })}
    </div>
  )
}

function Rows<T extends object>({
  title, rows, onChange, blank, fields,
}: {
  title: string
  rows: T[]
  onChange: (next: T[]) => void
  blank: T
  fields: { key: keyof T & string; label: string; wide?: boolean; area?: boolean }[]
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground">{title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { ...blank }])}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing added yet.</p>}
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
          {fields.map((field) => {
            const value = String((row as Record<string, unknown>)[field.key] ?? '')
            const update = (next: string) => onChange(rows.map((item, at) => (at === index ? { ...item, [field.key]: next || undefined } : item)))
            return field.area ? (
              <Textarea key={field.key} className="sm:col-span-2" rows={2} placeholder={field.label} value={value} onChange={(event) => update(event.target.value)} />
            ) : (
              <Input key={field.key} className={field.wide ? 'sm:col-span-2' : ''} placeholder={field.label} value={value} onChange={(event) => update(event.target.value)} />
            )
          })}
          <button type="button" aria-label="Remove row" onClick={() => onChange(rows.filter((_, at) => at !== index))} className="justify-self-start text-xs text-muted-foreground hover:text-destructive sm:col-span-2">
            <Trash2 className="mr-1 inline h-3 w-3" />Remove
          </button>
        </div>
      ))}
    </section>
  )
}

export default function HireProfilePage() {
  const mine = useQuery(api.talent.mine)
  const contacts = useQuery(api.talent.myContacts)
  const save = useMutation(api.talent.save)
  const setListing = useMutation(api.talent.setListing)
  const fillFromCv = useAction(api.talent.fillFromCv)

  const [form, setForm] = useState<TalentInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [reading, setReading] = useState(false)
  const loaded = mine ? JSON.stringify(mine.profile) : null

  useEffect(() => {
    if (!mine) return
    const p = mine.profile
    const empty = !p.headline && !p.summary && p.skills.length === 0
    // A first visit starts from what the job profile already knows.
    setForm(empty ? { ...p, skills: mine.jobSkills, families: mine.jobFamilies, seniority: mine.jobSeniority, country: mine.jobCountry, yearsExperience: mine.jobYears } : p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const patch = (next: Partial<TalentInput>) => setForm((current) => ({ ...current, ...next }))

  const persist = async () => {
    setSaving(true)
    try {
      await save(form as never)
      toast.success('Profile saved')
      return true
    } catch (error) {
      toast.error(message(error, 'Could not save'))
      return false
    } finally {
      setSaving(false)
    }
  }

  const readCv = async () => {
    setReading(true)
    try {
      const suggestion = await fillFromCv({})
      setForm((current) => ({ ...current, ...suggestion }))
      toast.success('Filled from your CV. Check each section, then save')
    } catch (error) {
      toast.error(message(error, 'Could not read the CV'))
    } finally {
      setReading(false)
    }
  }

  const toggleListing = async (listed: boolean, openToWork: boolean) => {
    if (!(await persist())) return
    try {
      await setListing({ listed, openToWork })
      toast.success(listed ? 'You are listed on /hire' : 'You are no longer listed')
    } catch (error) {
      toast.error(message(error, 'Could not change your listing'))
    }
  }

  if (mine === undefined) return <main className="px-6 py-8 lg:px-10"><p className="text-sm text-muted-foreground">Loading</p></main>
  if (mine === null) return null

  return (
    <main className="max-w-400 px-6 py-8 lg:px-10">
      <RoleNotice />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Hire profile</h1>
          <p className="text-sm text-muted-foreground">How recruiters see you on devrel.studio/hire. Nothing is public until you switch your listing on.</p>
        </div>
        <Button onClick={persist} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">{saving ? 'Saving' : 'Save profile'}</Button>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">{mine.listed ? 'You are listed' : 'You are not listed'}</p>
            <p className="text-sm text-muted-foreground">
              Profile {mine.completeness.score}% complete{mine.completeness.next ? `. Next: ${mine.completeness.next.toLowerCase()}.` : '.'}
              {mine.listed && mine.handle && <> <Link href={`/hire/${mine.handle}`} className="underline underline-offset-2">View your page</Link>.</>}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={mine.listed} onCheckedChange={(on) => toggleListing(on, on ? true : false)} />
              List me on /hire
            </label>
            <label className={`flex items-center gap-2 text-sm ${mine.listed ? '' : 'opacity-50'}`}>
              <Switch checked={mine.openToWork} disabled={!mine.listed} onCheckedChange={(on) => toggleListing(true, on)} />
              Open to work
            </label>
          </div>
        </div>
        {!mine.listed && mine.blockers.length > 0 && (
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {mine.blockers.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Recruiters never see your email or CV. They write to you through a form and you reply from your own inbox.
          {mine.proof.published > 0 ? ` Your ${mine.proof.published} published pieces show as proof automatically.` : ' Published work you track appears as proof automatically.'}
        </p>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-4">
        <Sparkles className="h-4 w-4 text-accent" />
        <p className="flex-1 text-sm text-muted-foreground">
          {mine.hasCv ? 'Fill experience, education, projects and communities from your saved CV. You review everything before it is saved.' : 'Upload your CV under Jobs, CV & preferences and this page can fill itself from it.'}
        </p>
        <Button variant="outline" disabled={!mine.hasCv || reading} onClick={readCv}>
          {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Fill from my CV
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">About you</h2>
          <Field label="Headline"><Input value={form.headline ?? ''} maxLength={120} onChange={(event) => patch({ headline: event.target.value })} placeholder="Developer advocate for developer infrastructure and AI" /></Field>
          <Field label="Summary"><Textarea rows={5} maxLength={900} value={form.summary ?? ''} onChange={(event) => patch({ summary: event.target.value })} placeholder="Two to four plain sentences in the first person" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Country">
              <select value={form.country ?? ''} onChange={(event) => patch({ country: event.target.value || undefined })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">Choose</option>
                {COUNTRY_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="City"><Input value={form.city ?? ''} onChange={(event) => patch({ city: event.target.value })} /></Field>
            <Field label="Time zone"><Input value={form.timezone ?? ''} onChange={(event) => patch({ timezone: event.target.value })} placeholder="WAT (UTC+1)" /></Field>
            <Field label="Years in the field"><Input type="number" min={0} max={50} value={form.yearsExperience ?? ''} onChange={(event) => patch({ yearsExperience: event.target.value ? Number(event.target.value) : undefined })} /></Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">What you are looking for</h2>
          <Field label="When can you start?">
            <select value={form.availability ?? ''} onChange={(event) => patch({ availability: event.target.value || undefined })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Choose</option>
              {AVAILABILITY.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Level">
            <select value={form.seniority ?? ''} onChange={(event) => patch({ seniority: event.target.value || undefined })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Choose</option>
              {SENIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Work mode"><Choice options={WORK_MODES} values={form.workModes} onChange={(workModes) => patch({ workModes })} /></Field>
          <Field label="Engagement"><Choice options={ENGAGEMENTS} values={form.engagements} onChange={(engagements) => patch({ engagements })} /></Field>
          <Field label="Focus"><Choice options={FAMILIES.map((family) => family.id)} values={form.families} onChange={(families) => patch({ families })} /></Field>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">Skills and languages</h2>
          <Field label="Skills (press Enter to add)"><Tags values={form.skills} onChange={(skills) => patch({ skills })} placeholder="TypeScript, Technical writing, Convex" /></Field>
          <Field label="Spoken languages"><Tags values={form.languages} onChange={(languages) => patch({ languages })} placeholder="English, Yoruba" /></Field>
        </section>

        <Rows
          title="Experience"
          rows={form.experience}
          onChange={(experience) => patch({ experience })}
          blank={{ company: '', title: '' }}
          fields={[{ key: 'title', label: 'Title' }, { key: 'company', label: 'Company' }, { key: 'start', label: 'Start (Mar 2023)' }, { key: 'end', label: 'End (Present)' }, { key: 'summary', label: 'What you did, in one sentence', area: true }]}
        />
        <Rows
          title="Projects"
          rows={form.projects}
          onChange={(projects) => patch({ projects })}
          blank={{ name: '' }}
          fields={[{ key: 'name', label: 'Name' }, { key: 'url', label: 'Link' }, { key: 'summary', label: 'What it is', area: true }]}
        />
        <Rows
          title="Communities"
          rows={form.communities}
          onChange={(communities) => patch({ communities })}
          blank={{ name: '' }}
          fields={[{ key: 'name', label: 'Community' }, { key: 'role', label: 'Your role' }, { key: 'url', label: 'Link', wide: true }]}
        />
        <Rows
          title="Education"
          rows={form.education}
          onChange={(education) => patch({ education })}
          blank={{ school: '' }}
          fields={[{ key: 'school', label: 'School', wide: true }, { key: 'degree', label: 'Degree or course' }, { key: 'year', label: 'Year' }]}
        />
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 font-medium text-foreground">Messages from recruiters</h2>
        {!contacts?.length ? (
          <p className="text-sm text-muted-foreground">No messages yet. Each one also arrives by email.</p>
        ) : (
          <ul className="divide-y divide-border">
            {contacts.map((item) => (
              <li key={item.id} className="py-3">
                <p className="text-sm font-medium text-foreground">{item.name}, {item.company} <a href={`mailto:${item.email}`} className="font-normal text-muted-foreground underline underline-offset-2">{item.email}</a></p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
