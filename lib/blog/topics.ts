// Topic choice: what is worth writing, and whether it has been written.

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'how', 'why', 'what', 'is', 'are', 'your',
  'you', 'do', 'does', 'can', 'should', 'vs', 'from', 'at', 'by', 'as', 'it', 'its', 'this', 'that', 'be', 'into',
  'about', 'using', 'use', 'guide', 'complete', 'developer', 'developers', 'relations',
])

export function tokens(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((word) => word.replace(/(ing|ed|es|s)$/, ''))
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  )]
}

/** Overlap of two phrases, 0 to 1. Order and small words do not matter. */
export function similarity(a: string, b: string): number {
  const left = new Set(tokens(a))
  const right = new Set(tokens(b))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const word of left) if (right.has(word)) shared++
  return shared / Math.min(left.size, right.size)
}

export interface Written {
  title: string
  keyword: string
}

export const DUPLICATE_AT = 0.7

/** The written post a new topic collides with, if any. */
export function findDuplicate(candidate: Written, existing: Written[]): Written | null {
  for (const post of existing) {
    if (similarity(candidate.keyword, post.keyword) >= DUPLICATE_AT) return post
    if (similarity(candidate.title, post.title) >= DUPLICATE_AT) return post
  }
  return null
}

/**
 * Evergreen subjects for people who work in developer relations, and the jobs
 * and tracking ground this product covers. Used when the news has nothing good.
 */
export const BACKLOG: string[] = [
  'How to measure developer relations without vanity metrics',
  'What a developer advocate does in a normal week',
  'How to write a DevRel report a CFO will read',
  'How much developer advocates earn at different levels',
  'What to put in a DevRel portfolio',
  'How to move from software engineer to developer advocate',
  'How to get your first developer advocate job',
  'How to tell which DevRel roles are real and which are marketing in disguise',
  'Developer success engineer versus developer advocate',
  'How to track content performance across dev.to, freeCodeCamp and your own blog',
  'How to prove the value of a tutorial with downloads and signups',
  'What a DevRel contract should include',
  'How to price freelance developer advocacy',
  'How to report DevRel work to several clients at once',
  'How to build a developer community that lasts past launch week',
  'How to write API documentation people finish reading',
  'How to run a developer hackathon and measure it',
  'How to give a conference talk that leads to real users',
  'How to write a technical tutorial that ranks in search',
  'How to write for AI answer engines as a technical writer',
  'What developer relations teams track in the first 90 days',
  'How to build a DevRel career without working at a large company',
  'How to use a job board to see what skills DevRel employers want',
  'How to write a CV for a developer relations role',
  'What questions to ask in a DevRel interview',
  'How to show impact in a developer advocate interview',
  'Remote DevRel jobs: what "remote" really means in a listing',
  'How to find contract DevRel work',
  'How to keep a log of your DevRel work so reviews are easy',
  'How to choose DevRel metrics for an early-stage startup',
]

export function pickBacklog(existing: Written[]): string | null {
  for (const title of BACKLOG) {
    if (!findDuplicate({ title, keyword: title }, existing)) return title
  }
  return null
}
