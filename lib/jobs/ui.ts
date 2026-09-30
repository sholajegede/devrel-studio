import { formatSalary } from './salary'
import { FAMILY_BY_ID, SENIORITY_BY_ID, type FamilyId, type SeniorityId } from './taxonomy'

const DAY = 24 * 60 * 60 * 1000

export function timeAgo(timestamp: number, now: number = Date.now()): string {
  const days = Math.floor((now - timestamp) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days}d ago`
  if (days < 60) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function payLabel(job: {
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
}): string | null {
  if (job.salaryMin == null || job.salaryMax == null || !job.salaryCurrency) return null
  return formatSalary({ min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency })
}

export const WORKPLACE_LABEL: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: 'Location not listed',
}

export function familyLabel(id: string): string {
  return FAMILY_BY_ID[id as FamilyId]?.label ?? id
}

export function seniorityLabel(id: string): string {
  return SENIORITY_BY_ID[id as SeniorityId]?.label ?? id
}

export function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function monogramHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360
  return hash
}

export function compactUsd(value: number): string {
  return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`
}
