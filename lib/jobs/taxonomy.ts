export type FamilyId =
  | 'advocacy'
  | 'devrel-engineering'
  | 'developer-success'
  | 'community'
  | 'content'
  | 'education'
  | 'programs'
  | 'marketing'
  | 'dx'

export interface Family {
  id: FamilyId
  label: string
  blurb: string
  core: boolean
}

export const FAMILIES: Family[] = [
  {
    id: 'advocacy',
    label: 'Developer Advocacy',
    blurb: 'Developer advocates, evangelists and DevRel managers and leads.',
    core: true,
  },
  {
    id: 'devrel-engineering',
    label: 'DevRel Engineering',
    blurb: 'Engineers who build demos, SDK samples and tooling for developers.',
    core: true,
  },
  {
    id: 'developer-success',
    label: 'Developer Success & Support',
    blurb: 'Developer success engineers and developer-facing support roles.',
    core: true,
  },
  {
    id: 'community',
    label: 'Community & Ecosystem',
    blurb: 'Community managers, open-source and ecosystem roles.',
    core: true,
  },
  {
    id: 'content',
    label: 'Technical Content & Docs',
    blurb: 'Technical writers, docs engineers and content engineers.',
    core: true,
  },
  {
    id: 'education',
    label: 'Developer Education',
    blurb: 'Developer educators, trainers and enablement roles.',
    core: true,
  },
  {
    id: 'programs',
    label: 'Developer Programs',
    blurb: 'Developer programs, ambassador and developer partnership roles.',
    core: true,
  },
  {
    id: 'marketing',
    label: 'Developer Marketing',
    blurb: 'Marketing roles aimed at developers.',
    core: false,
  },
  {
    id: 'dx',
    label: 'Developer Experience',
    blurb: 'Internal developer experience and productivity engineering.',
    core: false,
  },
]

export const FAMILY_BY_ID: Record<FamilyId, Family> = Object.fromEntries(
  FAMILIES.map((family) => [family.id, family]),
) as Record<FamilyId, Family>

export function isFamilyId(value: string): value is FamilyId {
  return value in FAMILY_BY_ID
}

export type SeniorityId =
  | 'intern'
  | 'junior'
  | 'mid'
  | 'senior'
  | 'staff'
  | 'principal'
  | 'manager'
  | 'director'
  | 'head'

export const SENIORITIES: { id: SeniorityId; label: string; rank: number }[] = [
  { id: 'intern', label: 'Intern', rank: 0 },
  { id: 'junior', label: 'Junior', rank: 1 },
  { id: 'mid', label: 'Mid-level', rank: 2 },
  { id: 'senior', label: 'Senior', rank: 3 },
  { id: 'staff', label: 'Staff', rank: 4 },
  { id: 'principal', label: 'Principal', rank: 5 },
  { id: 'manager', label: 'Lead / Manager', rank: 4 },
  { id: 'director', label: 'Director', rank: 6 },
  { id: 'head', label: 'Head / VP', rank: 7 },
]

export const SENIORITY_BY_ID = Object.fromEntries(
  SENIORITIES.map((level) => [level.id, level]),
) as Record<SeniorityId, (typeof SENIORITIES)[number]>

export function isSeniorityId(value: string): value is SeniorityId {
  return value in SENIORITY_BY_ID
}

interface Rule {
  family: FamilyId
  role: string
  test: RegExp
  needsDevCue?: boolean
}

const RULES: Rule[] = [
  {
    family: 'devrel-engineering',
    role: 'DevRel Engineer',
    test: /\b(developer relations|devrel|dev rel) engineer|\bdre\b|developer advocate engineer/,
  },
  {
    family: 'devrel-engineering',
    role: 'Developer Experience Engineer',
    test: /developer experience engineer|\bdx engineer\b|devex engineer/,
  },
  {
    family: 'dx',
    role: 'Developer Experience Engineer (internal)',
    test: /(software|platform|infrastructure|systems?) engineer.*(developer (experience|productivity|tooling|tools)|\bdx\b|devex)|developer (productivity|tooling|tools) engineer/,
  },
  {
    family: 'developer-success',
    role: 'Developer Success Engineer',
    test: /developer success|developer support|developer care|developer operations|api support|developer (solutions?|customer) engineer|solutions? engineer.*developer|developer.*solutions? engineer/,
  },
  {
    // External-facing leadership of developer experience is DevRel leadership.
    // Internal productivity and platform leads stay in the adjacent DX family.
    family: 'advocacy',
    role: 'Head of Developer Experience',
    test: /(head|vp|director|chief)[, ]+(of )?developer experience(?!.*(productivity|platform|infrastructure|tooling|engineering))|developer experience (head|director)/,
  },
  {
    family: 'advocacy',
    role: 'Head of DevRel',
    test: /(head|vp|director|chief).*(developer relations|devrel|developer advocacy|developer ecosystem)|(developer relations|devrel).*(head|director)/,
  },
  {
    family: 'advocacy',
    role: 'Technical Evangelist',
    test: /evangelist/,
  },
  {
    family: 'advocacy',
    role: 'Developer Advocate',
    test: /developer advocate|developer advocacy|technical advocate|\b(ai|ml|data|cloud|security|platform|api|open source)\s+advocate\b|advocate,? (ai|developer|open source)/,
  },
  {
    family: 'advocacy',
    role: 'Developer Relations Manager',
    test: /developer relations|devrel|dev rel\b|developer rel\b/,
  },
  {
    family: 'programs',
    role: 'Developer Programs Manager',
    test: /developer (programs?|partnerships?|ecosystem|platform partnerships?)|(ambassador|champions|builder|startup) program|developer relations program/,
  },
  {
    family: 'community',
    role: 'Open Source Program Manager',
    test: /open.source (program|community|manager|lead)|\bospo\b/,
  },
  {
    family: 'community',
    role: 'Developer Community Manager',
    test: /developer community|community (engineer|advocate)|technical community/,
  },
  {
    family: 'community',
    role: 'Ecosystem Manager',
    test: /ecosystem (manager|lead|engineer|growth|director|partner)/,
    needsDevCue: true,
  },
  {
    family: 'community',
    role: 'Community Manager',
    test: /community (manager|lead|programs?|specialist|coordinator|associate|operations|director|builder)|head of community|\bcommunity\b.*\b(manager|lead)\b/,
    needsDevCue: true,
  },
  {
    family: 'content',
    role: 'Technical Writer',
    test: /technical writer|documentation (writer|engineer|lead|manager)|docs (engineer|lead|writer|manager)|api documentation|developer documentation|technical editor|information architect/,
  },
  {
    family: 'content',
    role: 'Content Engineer',
    test: /content engineer|technical content|developer content|technical (blog|video) |content (strategist|lead).*developer/,
  },
  {
    family: 'education',
    role: 'Developer Educator',
    test: /developer (education|educator|enablement|training)|technical (trainer|training)|(education|curriculum) (engineer|lead|manager).*developer|developer learning/,
  },
  {
    family: 'marketing',
    role: 'Developer Marketing Manager',
    test: /developer (marketing|growth|audience|product marketing)|marketing.*\bdevelopers?\b|technical marketing|growth.*\bdevelopers?\b/,
  },
  {
    family: 'dx',
    role: 'Developer Experience Engineer (internal)',
    test: /developer (experience|productivity|tooling|tools|platform)\b|\bdevex\b/,
  },
]

const DEV_CUE = /\b(developers?|open.?source|apis?|sdks?|engineers?|devrel|programmers?)\b/i

export interface Classification {
  family: FamilyId
  role: string
  needsDevCue: boolean
}

export function classifyTitle(title: string): Classification | null {
  const normalised = title
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9+/&.,\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  for (const rule of RULES) {
    if (rule.test.test(normalised)) {
      return { family: rule.family, role: rule.role, needsDevCue: Boolean(rule.needsDevCue) }
    }
  }
  return null
}

export function confirmWithDescription(
  classification: Classification,
  description: string,
): boolean {
  if (!classification.needsDevCue) return true
  return DEV_CUE.test(description.slice(0, 6000))
}

export function detectSeniority(title: string): SeniorityId {
  const t = title.toLowerCase().replace(/[^a-z0-9. ]/g, ' ')
  if (/\bintern(ship)?\b|\bapprentice\b|\bco-?op\b/.test(t)) return 'intern'
  if (/\b(head of|vp|vice president|chief|cdo|cto)\b/.test(t)) return 'head'
  if (/\bdirector\b/.test(t)) return 'director'
  if (/\b(principal|distinguished|fellow)\b/.test(t)) return 'principal'
  if (/\bstaff\b/.test(t)) return 'staff'
  if (
    /\b(lead|founding lead|team lead)\b/.test(t) ||
    /\b(senior|sr\.?) manager\b/.test(t) ||
    /\bmanager\b[ ,-]+(of )?(developer|devrel|dev rel|community|advocacy|technical|open source|ecosystem|docs|documentation|content)/.test(t)
  ) {
    return 'manager'
  }
  if (/\b(senior|sr\.?|iii|iv)\b/.test(t)) return 'senior'
  if (/\b(junior|jr\.?|associate|entry|graduate|trainee|i)\b/.test(t)) return 'junior'
  return 'mid'
}

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'unknown'

export function detectEmployment(
  hint: string | null | undefined,
  title: string,
): EmploymentType {
  const text = `${hint ?? ''} ${title}`.toLowerCase()
  if (/intern/.test(text)) return 'internship'
  if (/contract|freelance|temporary|fixed.term|consult/.test(text)) return 'contract'
  if (/part.?time/.test(text)) return 'part-time'
  if (/full.?time|permanent|regular/.test(text)) return 'full-time'
  return hint ? 'unknown' : 'full-time'
}
