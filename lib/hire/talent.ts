// Pure logic for /hire: cleaning what a DevRel types, deciding whether a profile
// can be listed, summarising their tracked work as proof, and ranking the list.
// No Convex or React imports, so every rule here is covered by a unit test.

export const AVAILABILITY = [
  { id: 'now', label: 'Available now' },
  { id: '30d', label: 'Within 30 days' },
  { id: '90d', label: 'Within 3 months' },
  { id: 'exploring', label: 'Open to the right role' },
] as const
export type AvailabilityId = (typeof AVAILABILITY)[number]['id']

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const
export const ENGAGEMENTS = ['full-time', 'contract', 'part-time'] as const

export interface Experience { company: string; title: string; start?: string; end?: string; summary?: string }
export interface Education { school: string; degree?: string; year?: string }
export interface Project { name: string; url?: string; summary?: string }
export interface Community { name: string; role?: string; url?: string }

export interface TalentInput {
  headline?: string
  summary?: string
  country?: string
  city?: string
  timezone?: string
  availability?: string
  workModes: string[]
  engagements: string[]
  seniority?: string
  families: string[]
  skills: string[]
  languages: string[]
  yearsExperience?: number
  experience: Experience[]
  education: Education[]
  projects: Project[]
  communities: Community[]
}

const text = (value: string | undefined, max: number) => {
  const out = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  return out || undefined
}

/** Only absolute http(s) links survive. Anything else could be a script URL. */
export function safeUrl(value: string | undefined): string | undefined {
  const raw = (value ?? '').trim()
  if (!raw) return undefined
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (!url.hostname.includes('.')) return undefined
    return url.toString().slice(0, 300)
  } catch {
    return undefined
  }
}

const list = (values: string[], limit: number, max = 40) =>
  [...new Set(values.map((value) => value.replace(/\s+/g, ' ').trim().slice(0, max)).filter(Boolean))].slice(0, limit)

/** Trims, caps and drops empty rows. The server runs this on every save. */
export function cleanTalent(input: TalentInput): TalentInput {
  const yearsExperience =
    input.yearsExperience !== undefined && input.yearsExperience >= 0 && input.yearsExperience <= 50
      ? Math.round(input.yearsExperience)
      : undefined
  return {
    headline: text(input.headline, 120),
    summary: text(input.summary, 900),
    country: input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : undefined,
    city: text(input.city, 60),
    timezone: text(input.timezone, 40),
    availability: AVAILABILITY.some((item) => item.id === input.availability) ? input.availability : undefined,
    workModes: input.workModes.filter((mode) => (WORK_MODES as readonly string[]).includes(mode)),
    engagements: input.engagements.filter((kind) => (ENGAGEMENTS as readonly string[]).includes(kind)),
    seniority: input.seniority || undefined,
    families: list(input.families, 9, 30),
    skills: list(input.skills, 25),
    languages: list(input.languages, 8, 30),
    yearsExperience,
    experience: input.experience
      .map((row) => ({ company: text(row.company, 80) ?? '', title: text(row.title, 80) ?? '', start: text(row.start, 20), end: text(row.end, 20), summary: text(row.summary, 400) }))
      .filter((row) => row.company && row.title)
      .slice(0, 8),
    education: input.education
      .map((row) => ({ school: text(row.school, 100) ?? '', degree: text(row.degree, 100), year: text(row.year, 12) }))
      .filter((row) => row.school)
      .slice(0, 5),
    projects: input.projects
      .map((row) => ({ name: text(row.name, 80) ?? '', url: safeUrl(row.url), summary: text(row.summary, 240) }))
      .filter((row) => row.name)
      .slice(0, 6),
    communities: input.communities
      .map((row) => ({ name: text(row.name, 80) ?? '', role: text(row.role, 60), url: safeUrl(row.url) }))
      .filter((row) => row.name)
      .slice(0, 8),
  }
}

/** What must exist before a profile may appear on /hire. */
export function listingBlockers(profile: TalentInput): string[] {
  const out: string[] = []
  if (!profile.headline) out.push('Add a headline.')
  if (!profile.summary || profile.summary.length < 40) out.push('Write a summary of at least 40 characters.')
  if (profile.skills.length < 3) out.push('Add at least 3 skills.')
  if (!profile.country) out.push('Choose your country.')
  if (!profile.availability) out.push('Say when you can start.')
  return out
}

/** 0 to 100, with the next thing worth adding. Shown to the owner only. */
export function completeness(profile: TalentInput, hasProof: boolean): { score: number; next?: string } {
  const checks: [boolean, number, string][] = [
    [Boolean(profile.headline), 10, 'Add a headline'],
    [(profile.summary?.length ?? 0) >= 40, 15, 'Write a summary'],
    [profile.skills.length >= 5, 15, 'List five or more skills'],
    [profile.experience.length > 0, 20, 'Add your experience'],
    [profile.projects.length > 0, 10, 'Add a project'],
    [profile.communities.length > 0, 5, 'Add a community'],
    [profile.education.length > 0, 5, 'Add your education'],
    [Boolean(profile.country && profile.availability), 10, 'Set where you are and when you can start'],
    [hasProof, 10, 'Publish tracked work so recruiters see proof'],
  ]
  let score = 0
  let next: string | undefined
  for (const [ok, points, label] of checks) {
    if (ok) score += points
    else next ??= label
  }
  return { score, next }
}

// ── Proof ─────────────────────────────────────────────────────────────────────

export interface ProofEntry {
  category?: string
  platform: string
  publicationDate: string
  views?: number
  downloads?: number
  weeklyDownloads?: number
  attendees?: number
  stars?: number
}

export interface Proof {
  published: number
  byCategory: Record<string, number>
  latest?: string
  /** Chips worth showing. Small view counts are left out on purpose. */
  highlights: string[]
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)

export function summariseProof(entries: ProofEntry[]): Proof {
  const byCategory: Record<string, number> = {}
  let views = 0
  let downloads = 0
  let stars = 0
  let attendees = 0
  let latest: string | undefined
  for (const entry of entries) {
    const category = entry.category ?? 'Written'
    byCategory[category] = (byCategory[category] ?? 0) + 1
    views += entry.views ?? 0
    downloads += entry.downloads ?? 0
    stars += entry.stars ?? 0
    attendees += entry.attendees ?? 0
    if (!latest || entry.publicationDate > latest) latest = entry.publicationDate
  }
  const highlights: string[] = []
  if (entries.length) highlights.push(`${entries.length} published ${entries.length === 1 ? 'piece' : 'pieces'}`)
  if (byCategory.Event) highlights.push(`${byCategory.Event} ${byCategory.Event === 1 ? 'talk' : 'talks'}`)
  if (downloads >= 1000) highlights.push(`${compact(downloads)} package downloads`)
  if (stars >= 100) highlights.push(`${compact(stars)} GitHub stars`)
  if (attendees >= 100) highlights.push(`${compact(attendees)} event attendees`)
  if (views >= 100_000) highlights.push(`${compact(views)} views`)
  return { published: entries.length, byCategory, latest, highlights }
}

// ── Ranking and filters ───────────────────────────────────────────────────────

export interface Listed {
  openToWork: boolean
  availability?: string
  skills: string[]
  families: string[]
  seniority?: string
  country?: string
  workModes: string[]
  engagements: string[]
  yearsExperience?: number
  headline?: string
  summary?: string
  experience: Experience[]
  projects: Project[]
  communities: Community[]
  education: Education[]
  proof: Proof
  updatedAt: number
}

export interface TalentFilter {
  q?: string
  skills?: string[]
  families?: string[]
  seniority?: string[]
  country?: string
  workMode?: string
  engagement?: string
  openOnly?: boolean
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim()
const tokens = (value: string) => norm(value).split(' ').filter((word) => word.length > 1)

export function matchesFilter(person: Listed, filter: TalentFilter): boolean {
  if (filter.openOnly && !person.openToWork) return false
  if (filter.country && person.country !== filter.country) return false
  if (filter.workMode && !person.workModes.includes(filter.workMode)) return false
  if (filter.engagement && !person.engagements.includes(filter.engagement)) return false
  if (filter.seniority?.length && !(person.seniority && filter.seniority.includes(person.seniority))) return false
  if (filter.families?.length && !filter.families.some((family) => person.families.includes(family))) return false
  if (filter.skills?.length) {
    const have = new Set(person.skills.map(norm))
    // Every chosen skill must be present. A recruiter who ticks two skills wants both.
    if (!filter.skills.every((skill) => have.has(norm(skill)))) return false
  }
  return true
}

const AVAILABILITY_WEIGHT: Record<string, number> = { now: 12, '30d': 8, '90d': 4, exploring: 2 }

/**
 * Higher is better. Skill and keyword overlap come first, then open-to-work
 * status and how soon they can start, then evidence (tracked work, projects,
 * experience) and freshness. A fully filled profile outranks a bare one with the
 * same skills, which rewards the DevRels who did the work of filling it in.
 */
export function scoreTalent(person: Listed, filter: TalentFilter, now: number): number {
  let score = 0
  const query = tokens(filter.q ?? '')
  if (query.length) {
    const haystack = norm(
      [person.headline, person.summary, person.skills.join(' '), person.experience.map((row) => `${row.title} ${row.company}`).join(' '), person.projects.map((row) => row.name).join(' ')].join(' '),
    )
    const skillText = norm(person.skills.join(' '))
    for (const word of query) {
      if (skillText.includes(word)) score += 14
      else if (haystack.includes(word)) score += 6
    }
  }
  if (filter.skills?.length) score += filter.skills.length * 10
  if (person.openToWork) score += 10 + (AVAILABILITY_WEIGHT[person.availability ?? ''] ?? 0)
  score += Math.min(person.proof.published, 20) * 1.5
  score += Math.min(person.projects.length, 3) * 3
  score += Math.min(person.experience.length, 4) * 3
  score += Math.min(person.communities.length, 3) * 1.5
  score += Math.min(person.skills.length, 10)
  const ageDays = (now - person.updatedAt) / 86_400_000
  score += ageDays < 30 ? 6 : ageDays < 90 ? 3 : 0
  return Math.round(score * 10) / 10
}

export function rankTalent<T extends Listed>(people: T[], filter: TalentFilter, now = Date.now()): (T & { score: number })[] {
  return people
    .filter((person) => matchesFilter(person, filter))
    .map((person) => ({ ...person, score: scoreTalent(person, filter, now) }))
    .sort((a, b) => b.score - a.score)
}

/** Skills ranked by how many listed people have them, for the filter panel. */
export function skillFacets(people: Listed[], limit = 24): { skill: string; count: number }[] {
  const counts = new Map<string, { skill: string; count: number }>()
  for (const person of people) {
    for (const skill of person.skills) {
      const key = norm(skill)
      const row = counts.get(key)
      if (row) row.count += 1
      else counts.set(key, { skill, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill)).slice(0, limit)
}

/** The contact form checks. Pure so the form and the server agree. */
export function contactProblems(input: { name: string; email: string; company: string; message: string; website?: string }): string[] {
  const out: string[] = []
  if (input.website) out.push('Spam check failed.')
  if (input.name.trim().length < 2) out.push('Enter your name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) out.push('Enter a valid work email.')
  if (input.company.trim().length < 2) out.push('Enter your company.')
  const message = input.message.trim()
  if (message.length < 40) out.push('Write at least 40 characters about the role.')
  if (message.length > 2000) out.push('Keep the message under 2000 characters.')
  if ((message.match(/https?:\/\//g) ?? []).length > 3) out.push('Use at most three links.')
  return out
}
