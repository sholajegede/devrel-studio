import { extractSkills } from './skills'
import { classifyTitle, detectSeniority, SENIORITY_BY_ID, type SeniorityId } from './taxonomy'

export interface CvAnalysis {
  skills: string[]
  topics: string[]
  families: string[]
  seniority?: SeniorityId
  yearsExperience?: number
  headline?: string
}

const MAX_CV_CHARS = 60_000

function yearsFromRanges(text: string, now: Date): number | undefined {
  const currentYear = now.getUTCFullYear()
  const starts: number[] = []
  const pattern = /\b((?:19|20)\d{2})\s*(?:-|–|—|to)\s*(present|current|now|(?:19|20)\d{2})\b/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const start = Number(match[1])
    if (start >= 1990 && start <= currentYear) starts.push(start)
  }
  if (starts.length === 0) return undefined
  return Math.min(Math.max(currentYear - Math.min(...starts), 0), 40)
}

function yearsFromStatement(text: string): number | undefined {
  const values = [...text.matchAll(/\b(\d{1,2})\+?\s*(?:years?|yrs)\b(?:\s+of)?\s+(?:professional\s+|relevant\s+|industry\s+)?experience/gi)].map(
    (match) => Number(match[1]),
  )
  return values.length ? Math.min(Math.max(...values), 40) : undefined
}

export function analyseCv(rawText: string, now: Date = new Date()): CvAnalysis {
  const text = rawText.replace(/\r/g, '').slice(0, MAX_CV_CHARS)
  const { skills, topics } = extractSkills(text)

  const familyVotes = new Map<string, number>()
  let bestRank = -1
  let bestSeniority: SeniorityId | undefined
  let headline: string | undefined

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  for (const line of lines.slice(0, 400)) {
    if (line.length > 90) continue
    const classification = classifyTitle(line)
    if (!classification) continue
    familyVotes.set(classification.family, (familyVotes.get(classification.family) ?? 0) + 1)
    const seniority = detectSeniority(line)
    const rank = SENIORITY_BY_ID[seniority].rank
    if (rank > bestRank) {
      bestRank = rank
      bestSeniority = seniority
    }
    if (!headline) headline = line
  }

  const families = [...familyVotes.entries()].sort((a, b) => b[1] - a[1]).map(([family]) => family).slice(0, 3)

  const yearsExperience = yearsFromStatement(text) ?? yearsFromRanges(text, now)

  let seniority = bestSeniority
  if (!seniority && yearsExperience !== undefined) {
    seniority = yearsExperience >= 8 ? 'staff' : yearsExperience >= 4 ? 'senior' : yearsExperience >= 2 ? 'mid' : 'junior'
  }

  return { skills, topics, families, seniority, yearsExperience, headline }
}
