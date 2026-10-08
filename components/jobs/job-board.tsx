'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { Bell, Search, SlidersHorizontal, X } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { JobCard, type CardJob } from '@/components/jobs/job-card'
import { SaveButton } from '@/components/jobs/save-button'
import { useCountry } from '@/components/jobs/use-country'
import { COUNTRY_OPTIONS, REGIONS } from '@/lib/jobs/locations'
import { scoreJob, type MatchProfile } from '@/lib/jobs/match'
import { FAMILIES, SENIORITIES } from '@/lib/jobs/taxonomy'
import { pluralise } from '@/lib/jobs/ui'
import { track } from '@/lib/jobs/track'
import { normaliseTerm } from '@/lib/jobs/analytics'

export interface BoardResult {
  total: number
  hasMore: boolean
  items: CardJob[]
}

export interface BoardStats {
  total: number
  byFamily: { id: string; count: number }[]
  bySeniority: { id: string; count: number }[]
  byWorkplace: { id: string; count: number }[]
  byRegion: { id: string; count: number }[]
  bySkill: { id: string; count: number }[]
  visaSponsorship?: number
}

const PAGE = 40
const PERSONAL_SCAN = 400
const WORKPLACES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
]
const EMPLOYMENT = [
  { id: 'full-time', label: 'Full-time' },
  { id: 'contract', label: 'Contract and freelance' },
  { id: 'part-time', label: 'Part-time' },
  { id: 'internship', label: 'Internship' },
]
const PAY_STEPS = [0, 80_000, 100_000, 130_000, 160_000, 200_000]
const POSTED = [
  { id: '0', label: 'Any time' },
  { id: '1', label: 'Last 24 hours' },
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
]

const csv = (value: string | null) => (value ? value.split(',').filter(Boolean) : [])

const FILTER_NAMES: Record<string, string> = {
  f: 'role type', s: 'level', w: 'workplace', e: 'job type', r: 'region', k: 'skill',
  min: 'minimum pay', pay: 'only with pay', visa: 'visa sponsorship', d: 'posted', open: 'hide closed to me',
}

/** Says what changed between two sets of filters, for analytics. */
function trackFilterChange(before: URLSearchParams, after: URLSearchParams) {
  for (const key of Object.keys(FILTER_NAMES)) {
    const was = new Set(csv(before.get(key)))
    const now = new Set(csv(after.get(key)))
    for (const value of now) if (!was.has(value)) track('filter_on', { label: `${FILTER_NAMES[key]}: ${value}` })
    for (const value of was) if (!now.has(value)) track('filter_off', { label: `${FILTER_NAMES[key]}: ${value}` })
  }
  const adjBefore = before.get('adj') === '1'
  const adjAfter = after.get('adj') === '1'
  if (adjBefore !== adjAfter) track(adjAfter ? 'adjacent_on' : 'adjacent_off')
  if ((before.get('sort') ?? '') !== (after.get('sort') ?? '')) track('sort_change', { label: after.get('sort') ?? 'default' })
}

export function JobBoard({
  initial,
  stats,
  mode = 'public',
  profile,
  lockedFamily,
  lockedCompany,
  lockedEmployment,
}: {
  initial?: BoardResult
  stats?: BoardStats | null
  mode?: 'public' | 'dashboard'
  profile?: (MatchProfile & { headline?: string }) | null
  lockedFamily?: string
  lockedCompany?: string
  lockedEmployment?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const personal = mode === 'dashboard'

  const [country, setCountryRaw] = useCountry(profile?.country)
  const setCountry = (code: string | undefined) => {
    setCountryRaw(code)
    track('country_set', { label: code ?? 'cleared' })
  }
  const [text, setText] = useState(params.get('q') ?? '')
  const [limit, setLimit] = useState(PAGE)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filterKey = params.toString()
  useEffect(() => setLimit(PAGE), [filterKey, country])

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString())
    mutate(next)
    trackFilterChange(params, next)
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const toggleIn = (key: string, value: string) =>
    update((next) => {
      const current = csv(next.get(key))
      const updated = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
      if (updated.length) next.set(key, updated.join(','))
      else next.delete(key)
    })

  const setParam = (key: string, value: string | null) =>
    update((next) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })

  useEffect(() => {
    const handle = setTimeout(() => {
      if ((params.get('q') ?? '') !== text.trim()) setParam('q', text.trim() || null)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const families = lockedFamily ? [lockedFamily] : csv(params.get('f'))
  const seniority = csv(params.get('s'))
  const workplaces = csv(params.get('w'))
  const employment = lockedEmployment ? [lockedEmployment] : csv(params.get('e'))
  const regions = csv(params.get('r'))
  const skills = csv(params.get('k'))
  const minPay = Number(params.get('min') ?? 0)
  const salaryOnly = params.get('pay') === '1'
  const visaOnly = params.get('visa') === '1'
  const includeAdjacent = params.get('adj') === '1'
  const posted = Number(params.get('d') ?? 0)
  const sort = (params.get('sort') ?? (personal ? 'match' : 'newest')) as 'newest' | 'salary' | 'match'
  const hideClosed = params.get('open') === '1'

  const hasFilters =
    families.length > 0 && !lockedFamily ||
    seniority.length > 0 ||
    workplaces.length > 0 ||
    (employment.length > 0 && !lockedEmployment) ||
    regions.length > 0 ||
    skills.length > 0 ||
    minPay > 0 ||
    salaryOnly ||
    visaOnly ||
    posted > 0 ||
    Boolean(params.get('q')) ||
    hideClosed

  const args = {
    q: params.get('q') || undefined,
    families: families.length ? families : undefined,
    seniority: seniority.length ? seniority : undefined,
    workplaces: workplaces.length ? workplaces : undefined,
    employment: employment.length ? employment : undefined,
    regions: regions.length ? regions : undefined,
    skills: skills.length ? skills : undefined,
    country: hideClosed ? country : undefined,
    company: lockedCompany,
    minSalaryUsd: minPay || undefined,
    salaryOnly: salaryOnly || undefined,
    visaOnly: visaOnly || undefined,
    includeAdjacent: includeAdjacent || undefined,
    postedWithinDays: posted || undefined,
    sort: sort === 'salary' ? ('salary' as const) : ('newest' as const),
    limit: personal ? PERSONAL_SCAN : limit,
  }

  const untouched = !hasFilters && !includeAdjacent && sort === 'newest' && !personal && limit === PAGE
  const live = useQuery(api.jobs.list, args)
  const held = useRef<BoardResult | undefined>(initial)
  if (live) held.current = live as BoardResult
  const result: BoardResult | undefined = live ?? (untouched ? initial : held.current)

  const scored = useMemo(() => {
    if (!result) return []
    if (!personal || !profile) return result.items.map((job) => ({ job, match: undefined }))
    const withScores = result.items.map((job) => ({
      job,
      match: scoreJob({ ...profile, country }, job),
    }))
    if (sort === 'match') withScores.sort((a, b) => b.match.score - a.match.score || b.job.postedAt - a.job.postedAt)
    return withScores
  }, [result, personal, profile, country, sort])

  const visible = personal ? scored.slice(0, limit) : scored
  const total = result?.total ?? 0

  // What people look for, and what they cannot find.
  const reported = useRef('')
  useEffect(() => {
    if (!live) return
    const term = normaliseTerm(params.get('q') ?? '')
    const signature = `${term}|${filterKey}|${live.total}`
    if (reported.current === signature) return
    reported.current = signature
    if (term) track('search', { label: term, n: live.total })
    if (live.total === 0 && (term || hasFilters)) track('no_results', { label: term || filterKey.slice(0, 100) || 'filters' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.total, filterKey])
  const canMore = personal ? scored.length > limit : Boolean(result?.hasMore)
  const linkBase = '/jobs'

  const count = (list: { id: string; count: number }[] | undefined, id: string) =>
    list?.find((entry) => entry.id === id)?.count

  const Group = ({ title, children, tour }: { title: string; children: React.ReactNode; tour?: string }) => (
    <fieldset className="space-y-2" data-tour={tour}>
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  )

  const Check = ({
    active,
    label,
    n,
    onChange,
  }: {
    active: boolean
    label: string
    n?: number
    onChange: () => void
  }) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={active}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-border accent-[var(--accent)]"
      />
      <span className="flex-1">{label}</span>
      {n !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{n}</span>}
    </label>
  )

  const visibleFamilies = FAMILIES.filter((family) => family.core || includeAdjacent)

  const filters = (
    <div className="space-y-6">
      {!lockedFamily && (
        <Group title="Role type" tour="jobs-role-type">
          {visibleFamilies.map((family) => (
            <Check
              key={family.id}
              active={families.includes(family.id)}
              label={family.label}
              n={count(stats?.byFamily, family.id)}
              onChange={() => toggleIn('f', family.id)}
            />
          ))}
          <label data-tour="jobs-adjacent" className="flex cursor-pointer items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            Include adjacent roles
            <Switch
              checked={includeAdjacent}
              onCheckedChange={(on) => setParam('adj', on ? '1' : null)}
              aria-label="Include adjacent roles"
            />
          </label>
        </Group>
      )}

      <Group title="Level" tour="jobs-level">
        {SENIORITIES.map((level) => (
          <Check
            key={level.id}
            active={seniority.includes(level.id)}
            label={level.label}
            n={count(stats?.bySeniority, level.id)}
            onChange={() => toggleIn('s', level.id)}
          />
        ))}
      </Group>

      <Group title="Workplace">
        {WORKPLACES.map((place) => (
          <Check
            key={place.id}
            active={workplaces.includes(place.id)}
            label={place.label}
            n={count(stats?.byWorkplace, place.id)}
            onChange={() => toggleIn('w', place.id)}
          />
        ))}
      </Group>

      {!lockedEmployment && (
        <Group title="Job type" tour="jobs-type">
          {EMPLOYMENT.map((type) => (
            <Check
              key={type.id}
              active={employment.includes(type.id)}
              label={type.label}
              onChange={() => toggleIn('e', type.id)}
            />
          ))}
        </Group>
      )}

      <Group title="Region">
        {REGIONS.map((region) => (
          <Check
            key={region.id}
            active={regions.includes(region.id)}
            label={region.label}
            n={count(stats?.byRegion, region.id)}
            onChange={() => toggleIn('r', region.id)}
          />
        ))}
      </Group>

      <Group title="Where do you live?" tour="jobs-country">
        <select
          value={country ?? ''}
          onChange={(event) => setCountry(event.target.value || undefined)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          aria-label="Your country"
        >
          <option value="">Not set</option>
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center justify-between gap-2 pt-1 text-sm text-foreground">
          Hide roles closed to me
          <Switch
            checked={hideClosed}
            disabled={!country}
            onCheckedChange={(on) => setParam('open', on ? '1' : null)}
            aria-label="Hide roles closed to me"
          />
        </label>
      </Group>

      <Group title="Visa">
        <label className="flex cursor-pointer items-center justify-between gap-2 text-sm text-foreground">
          <span>
            Offers visa sponsorship
            {stats?.visaSponsorship ? <span className="ml-1 text-xs text-muted-foreground">{stats.visaSponsorship}</span> : null}
          </span>
          <Switch
            checked={visaOnly}
            onCheckedChange={(on) => setParam('visa', on ? '1' : null)}
            aria-label="Only roles that offer visa sponsorship"
          />
        </label>
        <p className="text-xs text-muted-foreground">Based on what each posting says. Many do not say, so check the posting.</p>
      </Group>

      <Group title="Pay" tour="jobs-pay">
        <label className="flex cursor-pointer items-center justify-between gap-2 text-sm text-foreground">
          Only roles that list pay
          <Switch
            checked={salaryOnly}
            onCheckedChange={(on) => setParam('pay', on ? '1' : null)}
            aria-label="Only roles that list pay"
          />
        </label>
        <select
          value={minPay}
          onChange={(event) => setParam('min', Number(event.target.value) ? event.target.value : null)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          aria-label="Minimum pay"
        >
          {PAY_STEPS.map((step) => (
            <option key={step} value={step}>
              {step ? `At least $${step / 1000}k a year` : 'Any pay'}
            </option>
          ))}
        </select>
      </Group>

      <Group title="Posted">
        <select
          value={String(posted)}
          onChange={(event) => setParam('d', event.target.value === '0' ? null : event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          aria-label="Posted within"
        >
          {POSTED.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </Group>

      {stats && stats.bySkill.length > 0 && (
        <Group title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {stats.bySkill.slice(0, 16).map((skill) => {
              const active = skills.includes(skill.id)
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleIn('k', skill.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? 'border-foreground/25 bg-secondary text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {skill.id}
                </button>
              )
            })}
          </div>
        </Group>
      )}
    </div>
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">{filters}</div>
      </aside>

      <section aria-label="Job listings" className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div data-tour="jobs-search" className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Search roles, companies, skills"
              aria-label="Search jobs"
              className="pl-9"
            />
          </div>
          <Button variant="outline" className="lg:hidden" onClick={() => {
            if (!filtersOpen) track('filters_open')
            setFiltersOpen((open) => !open)
          }}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          <select
            value={sort}
            onChange={(event) => setParam('sort', event.target.value === (personal ? 'match' : 'newest') ? null : event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            aria-label="Sort"
            data-tour="jobs-sort"
          >
            {personal && <option value="match">Best match</option>}
            <option value="newest">Newest</option>
            <option value="salary">Highest pay</option>
          </select>
        </div>

        {filtersOpen && <div className="mt-4 rounded-xl border border-border bg-card p-4 lg:hidden">{filters}</div>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p aria-live="polite">
            {result ? pluralise(total, 'role') : 'Loading roles'}
            {personal && profile && profile.skills.length > 0 ? ' ranked against your CV' : ''}
          </p>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { track('clear_filters'); setText(''); router.replace(pathname, { scroll: false }) }}>
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
            {personal && (
              <Button asChild variant="outline" size="sm" data-tour="jobs-alert">
                <Link href={`/dashboard/jobs/alerts${filterKey ? `?${filterKey}` : ''}`}>
                  <Bell className="h-3.5 w-3.5" />
                  Alert me
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {visible.map(({ job, match }, index) => (
            <div key={job._id} data-tour={index === 0 ? 'jobs-card' : undefined}>
            <JobCard
              job={job}
              href={`${linkBase}/${job.slug}`}
              country={country}
              match={match}
              action={
                <>
                  {personal && (
                    <Link
                      href={`/dashboard/jobs/kit/${job.slug}`}
                      data-tour={index === 0 ? 'jobs-tailor' : undefined}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:border-accent hover:text-accent"
                    >
                      Tailor CV
                    </Link>
                  )}
                  <span data-tour={index === 0 ? 'jobs-save' : undefined}>
                    <SaveButton jobId={job._id} />
                  </span>
                </>
              }
            />
            </div>
          ))}

          {result && visible.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="font-medium text-foreground">No roles match these filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a wider region or remove a filter. New roles arrive three times a day.
              </p>
            </div>
          )}
        </div>

        {canMore && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => { track('load_more', { n: limit + PAGE }); setLimit((current) => current + PAGE) }}>
              Show more roles
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
