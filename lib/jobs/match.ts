import { eligibility, type Eligibility, type RemoteScope, type Workplace } from './locations'
import { FAMILY_BY_ID, SENIORITY_BY_ID, type FamilyId, type SeniorityId } from './taxonomy'

export interface MatchProfile {
  skills: string[]
  families: string[]
  seniority?: string
  workplaces: string[]
  country?: string
  minSalaryUsd?: number
}

export interface MatchJob {
  family: string
  seniority: string
  workplace: string
  remoteScope?: string | null
  countries: string[]
  regions: string[]
  skills: string[]
  salaryMaxUsd?: number | null
}

export interface MatchResult {
  score: number
  reasons: string[]
  gaps: string[]
  eligibility: Eligibility | null
}

const list = (items: string[], limit = 4) =>
  items.length > limit ? `${items.slice(0, limit).join(', ')} +${items.length - limit}` : items.join(', ')

export function scoreJob(profile: MatchProfile, job: MatchJob): MatchResult {
  const reasons: string[] = []
  const gaps: string[] = []
  let score = 0

  const owned = new Set(profile.skills.map((skill) => skill.toLowerCase()))
  const matched = job.skills.filter((skill) => owned.has(skill.toLowerCase()))
  const missing = job.skills.filter((skill) => !owned.has(skill.toLowerCase()))
  if (job.skills.length > 0 && profile.skills.length > 0) {
    const denominator = Math.min(job.skills.length, 8)
    score += Math.round(40 * Math.min(matched.length / denominator, 1))
    if (matched.length > 0) {
      reasons.push(`Uses ${matched.length} of your skills: ${list(matched)}`)
    }
    if (missing.length > 0) gaps.push(`Also asks for ${list(missing, 3)}`)
  } else {
    score += 14
  }

  const familyLabel = FAMILY_BY_ID[job.family as FamilyId]?.label ?? job.family
  if (profile.families.length === 0) {
    score += 10
  } else if (profile.families.includes(job.family)) {
    score += 20
    reasons.push(`In your focus: ${familyLabel}`)
  } else if (FAMILY_BY_ID[job.family as FamilyId]?.core) {
    score += 6
  }

  const mine = profile.seniority ? SENIORITY_BY_ID[profile.seniority as SeniorityId] : undefined
  const theirs = SENIORITY_BY_ID[job.seniority as SeniorityId]
  if (mine && theirs) {
    const distance = Math.abs(mine.rank - theirs.rank)
    score += distance === 0 ? 15 : distance === 1 ? 9 : distance === 2 ? 3 : 0
    if (distance === 0) reasons.push(`${theirs.label} level, same as yours`)
    else if (theirs.rank > mine.rank) gaps.push(`A step up: ${theirs.label}`)
  } else {
    score += 7
  }

  let fit: Eligibility | null = null
  if (profile.country) {
    fit = eligibility(
      {
        workplace: job.workplace as Workplace,
        remoteScope: job.remoteScope as RemoteScope | null | undefined,
        countries: job.countries,
        regions: job.regions,
      },
      profile.country,
    )
    if (fit === 'yes') {
      score += 15
      reasons.push('Open to candidates where you live')
    } else if (fit === 'local') {
      score += 15
      reasons.push('Based in your country')
    } else if (fit === 'unknown') {
      score += 6
    } else {
      gaps.push('Not open to your location')
    }
  } else {
    score += 7
  }

  if (profile.workplaces.length === 0 || profile.workplaces.includes(job.workplace)) score += 5

  if (profile.minSalaryUsd && job.salaryMaxUsd) {
    if (job.salaryMaxUsd >= profile.minSalaryUsd) {
      score += 5
      reasons.push('Pay clears your minimum')
    } else {
      gaps.push('Pay is below your minimum')
    }
  } else {
    score += 2
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, gaps, eligibility: fit }
}

export function matchLabel(score: number): string {
  if (score >= 80) return 'Strong match'
  if (score >= 60) return 'Good match'
  if (score >= 40) return 'Possible'
  return 'Stretch'
}
