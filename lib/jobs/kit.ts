import { STYLE_RULES } from './slop'

export interface KitJob {
  title: string
  company: string
  seniority: string
  skills: string[]
  description: string
}

export interface KitProfile {
  headline?: string
  skills: string[]
  yearsExperience?: number
  cvText: string
}

export interface ProofItem {
  title: string
  category?: string
  platform: string
  date: string
  views?: number
  link: string
}

export interface KitOutput {
  summary: string
  bullets: string[]
  coverNote: string
  gaps: string[]
}

export function proofLines(items: ProofItem[]): string[] {
  return items.map((item) => {
    const views = item.views ? `, ${item.views.toLocaleString('en-US')} views` : ''
    return `${item.category ?? 'Content'}: "${item.title}" on ${item.platform}, ${item.date}${views} (${item.link})`
  })
}

export function buildPrompt(job: KitJob, profile: KitProfile, proof: ProofItem[]): { system: string; user: string } {
  const system = `You tailor a developer relations CV for one specific role. You only rearrange and sharpen what the candidate has already shown. ${STYLE_RULES}

Return only JSON with this shape and nothing else:
{"summary": "2 sentences, no subject-less buzzwords", "bullets": ["5 to 7 CV bullets ordered by relevance to this role"], "coverNote": "110 to 170 words, first person, three short paragraphs", "gaps": ["requirements of the role the CV does not show"]}`

  const proofBlock = proof.length
    ? `Published work tracked in devrel.studio (real, checkable):\n${proofLines(proof).join('\n')}`
    : 'No tracked published work.'

  const user = `ROLE
${job.title} at ${job.company} (${job.seniority})
Skills the listing names: ${job.skills.join(', ') || 'none listed'}

LISTING
${job.description.slice(0, 5000)}

CANDIDATE
Headline: ${profile.headline ?? 'not given'}
Years of experience: ${profile.yearsExperience ?? 'not given'}
Skills: ${profile.skills.join(', ') || 'not given'}

CV TEXT
${profile.cvText.slice(0, 9000)}

${proofBlock}`
  return { system, user }
}

export function parseKit(raw: string): KitOutput | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
    const list = (value: unknown) =>
      Array.isArray(value) ? value.map(text).filter(Boolean) : []
    const output: KitOutput = {
      summary: text(data.summary),
      bullets: list(data.bullets).slice(0, 8),
      coverNote: text(data.coverNote),
      gaps: list(data.gaps).slice(0, 6),
    }
    if (!output.coverNote || output.bullets.length === 0) return null
    return output
  } catch {
    return null
  }
}

export function kitText(output: KitOutput): string {
  return [output.summary, ...output.bullets, output.coverNote].join('\n')
}

export function repairPrompt(output: KitOutput, problems: string[]): string {
  return `Fix these problems in the JSON below without adding any new facts. Problems:\n${problems
    .map((item) => `- ${item}`)
    .join('\n')}\n\nReturn the corrected JSON only, same shape.\n\n${JSON.stringify(output)}`
}
