'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COUNTRY_OPTIONS } from '@/lib/jobs/locations'
import { FAMILY_BY_ID, SENIORITIES, type FamilyId } from '@/lib/jobs/taxonomy'
import {
  AVAILABILITY, ENGAGEMENTS, WORK_MODES, rankTalent, skillFacets, type Listed, type TalentFilter,
} from '@/lib/hire/talent'

export interface TalentCard extends Listed {
  handle: string
  name: string
  imageUrl?: string
  city?: string
}

const countryName = (code?: string) => COUNTRY_OPTIONS.find((item) => item.code === code)?.name
const availabilityLabel = (id?: string) => AVAILABILITY.find((item) => item.id === id)?.label
const seniorityLabel = (id?: string) => SENIORITIES.find((item) => item.id === id)?.label
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export function Avatar({ name, imageUrl, size = 48 }: { name: string; imageUrl?: string; size?: number }) {
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground" style={{ width: size, height: size }}>
      {initials}
    </span>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function TalentDirectory({ people }: { people: TalentCard[] }) {
  const [filter, setFilter] = useState<TalentFilter>({})
  const patch = (next: Partial<TalentFilter>) => setFilter((current) => ({ ...current, ...next }))
  const toggle = (key: 'skills' | 'seniority' | 'families', value: string) => {
    const list = filter[key] ?? []
    patch({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] })
  }

  const facets = useMemo(() => skillFacets(people), [people])
  const countries = useMemo(() => [...new Set(people.map((person) => person.country).filter(Boolean))] as string[], [people])
  const ranked = useMemo(() => rankTalent(people, filter), [people, filter])
  const chosen = new Set((filter.skills ?? []).map((skill) => skill.toLowerCase()))
  const active = Boolean(filter.q || filter.skills?.length || filter.families?.length || filter.seniority?.length || filter.country || filter.workMode || filter.engagement || filter.openOnly)

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Filters">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter.q ?? ''}
            onChange={(event) => patch({ q: event.target.value })}
            placeholder="Search skills, roles, projects"
            aria-label="Search"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(filter.openOnly)} onChange={(event) => patch({ openOnly: event.target.checked })} />
          Open to work only
        </label>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {facets.map((facet) => (
              <Chip key={facet.skill} active={chosen.has(facet.skill.toLowerCase())} onClick={() => toggle('skills', facet.skill)}>
                {facet.skill} <span className="text-muted-foreground">{facet.count}</span>
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Level</p>
          <div className="flex flex-wrap gap-1.5">
            {SENIORITIES.filter((level) => people.some((person) => person.seniority === level.id)).map((level) => (
              <Chip key={level.id} active={Boolean(filter.seniority?.includes(level.id))} onClick={() => toggle('seniority', level.id)}>
                {level.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Focus</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FAMILY_BY_ID) as FamilyId[]).filter((id) => people.some((person) => person.families.includes(id))).map((id) => (
              <Chip key={id} active={Boolean(filter.families?.includes(id))} onClick={() => toggle('families', id)}>
                {FAMILY_BY_ID[id].label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <select aria-label="Country" value={filter.country ?? ''} onChange={(event) => patch({ country: event.target.value || undefined })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Any country</option>
            {countries.map((code) => <option key={code} value={code}>{countryName(code) ?? code}</option>)}
          </select>
          <select aria-label="Work mode" value={filter.workMode ?? ''} onChange={(event) => patch({ workMode: event.target.value || undefined })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Any work mode</option>
            {WORK_MODES.map((mode) => <option key={mode} value={mode}>{cap(mode)}</option>)}
          </select>
          <select aria-label="Engagement" value={filter.engagement ?? ''} onChange={(event) => patch({ engagement: event.target.value || undefined })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Any engagement</option>
            {ENGAGEMENTS.map((kind) => <option key={kind} value={kind}>{cap(kind)}</option>)}
          </select>
        </div>

        {active && (
          <button type="button" onClick={() => setFilter({})} className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Clear filters
          </button>
        )}
      </aside>

      <section aria-live="polite">
        <p className="mb-4 text-sm text-muted-foreground">
          {ranked.length} {ranked.length === 1 ? 'DevRel' : 'DevRels'}
          {filter.q || filter.skills?.length ? ', best match first' : ''}
        </p>

        {ranked.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {people.length === 0 ? 'No one is listed yet.' : 'No one matches these filters. Remove one to see more people.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {ranked.map((person) => {
              const latest = person.experience[0]
              const place = [person.city, countryName(person.country)].filter(Boolean).join(', ')
              return (
                <li key={person.handle}>
                  <Link href={`/hire/${person.handle}`} className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent/60">
                    <div className="flex items-start gap-4">
                      <Avatar name={person.name} imageUrl={person.imageUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-medium text-foreground">{person.name}</h2>
                          {person.openToWork && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                              {availabilityLabel(person.availability) ?? 'Open to work'}
                            </span>
                          )}
                        </div>
                        {person.headline && <p className="mt-0.5 text-sm text-foreground/90">{person.headline}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[seniorityLabel(person.seniority), person.yearsExperience ? `${person.yearsExperience} years` : null, place, person.workModes.map(cap).join(' / ')].filter(Boolean).join(' · ')}
                        </p>
                        {latest && <p className="mt-2 text-sm text-muted-foreground">{latest.title}, {latest.company}</p>}
                        {person.proof.highlights.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">{person.proof.highlights.join(' · ')}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {[...person.skills].sort((a, b) => Number(chosen.has(b.toLowerCase())) - Number(chosen.has(a.toLowerCase()))).slice(0, 7).map((skill) => (
                            <span key={skill} className={cn('rounded-md px-2 py-0.5 text-xs', chosen.has(skill.toLowerCase()) ? 'bg-accent/15 text-foreground' : 'bg-muted text-muted-foreground')}>
                              {skill}
                            </span>
                          ))}
                          {person.skills.length > 7 && <span className="px-1 text-xs text-muted-foreground">+{person.skills.length - 7}</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
