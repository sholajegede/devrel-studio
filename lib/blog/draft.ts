import { findSlop, ungroundedNumbers } from '../jobs/slop'
import { parseMarkdown, plainText, wordCount } from './markdown'
import { sanitizeSvg } from './svg'

export interface Draft {
  title: string
  description: string
  keyword: string
  slug: string
  body: string
  faq: { q: string; a: string }[]
}

/** Reads the writer's delimited output. Returns null if a part is missing. */
export function parseDraft(raw: string): Draft | null {
  const text = raw.replace(/\r\n/g, '\n').trim()
  const bodyStart = text.indexOf('---BODY---')
  const faqStart = text.indexOf('---FAQ---')
  if (bodyStart === -1) return null

  const head = text.slice(0, bodyStart)
  const field = (name: string) => new RegExp(`^${name}:\\s*(.+)$`, 'mi').exec(head)?.[1]?.trim()
  const title = field('TITLE')
  const description = field('DESCRIPTION')
  const keyword = field('KEYWORD')
  const slug = (field('SLUG') ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  if (!title || !description || !keyword || !slug) return null

  const body = text.slice(bodyStart + '---BODY---'.length, faqStart === -1 ? undefined : faqStart).trim()
  const faqText = faqStart === -1 ? '' : text.slice(faqStart + '---FAQ---'.length)
  const faq: { q: string; a: string }[] = []
  const pattern = /^Q:\s*(.+)\nA:\s*([\s\S]+?)(?=\nQ:|\s*$)/gm
  let found: RegExpExecArray | null
  while ((found = pattern.exec(faqText.trim())) !== null) faq.push({ q: found[1].trim(), a: found[2].trim().replace(/\s+/g, ' ') })

  if (body.length < 500) return null
  return { title, description, keyword, slug, body, faq }
}

export function draftToText(draft: Draft): string {
  return [
    `TITLE: ${draft.title}`,
    `DESCRIPTION: ${draft.description}`,
    `KEYWORD: ${draft.keyword}`,
    `SLUG: ${draft.slug}`,
    '---BODY---',
    draft.body,
    '---FAQ---',
    ...draft.faq.flatMap((item) => [`Q: ${item.q}`, `A: ${item.a}`]),
  ].join('\n')
}

const sentencesOf = (text: string) =>
  text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => wordCount(sentence) >= 2)

/** Everything a human editor would catch on a first read. Empty means it passes. */
export function checkDraft(draft: Draft, groundTruth: string[]): string[] {
  const problems: string[] = []
  const blocks = parseMarkdown(draft.body)
  const text = plainText(blocks)
  const words = wordCount(text)

  if (draft.title.length < 25 || draft.title.length > 80) problems.push(`Title is ${draft.title.length} characters. Make it 25 to 80.`)
  if (/^(building|creating|using|making|understanding|getting|writing)\b/i.test(draft.title)) problems.push('Title starts with an -ing word. Use "How to", "Why" or "What".')
  if (draft.description.length < 100 || draft.description.length > 165) problems.push(`Description is ${draft.description.length} characters. Make it 120 to 155.`)
  if (words < 850 || words > 1900) problems.push(`Body is ${words} words. Make it 1000 to 1500.`)

  const firstHeading = blocks.findIndex((block) => block.t === 'h')
  const intro = blocks.slice(0, firstHeading === -1 ? blocks.length : firstHeading)
  const quick = intro.find((block) => block.t === 'p' && /^quick answer/i.test(plainText([block]).trim()))
  if (!quick) problems.push('Missing the "**Quick answer:**" paragraph before the first heading.')
  else {
    const n = wordCount(plainText([quick]))
    if (n < 30 || n > 80) problems.push(`The quick answer is ${n} words. Make it 40 to 60.`)
  }

  const h2 = blocks.filter((block) => block.t === 'h' && block.level === 2)
  if (h2.length < 4 || h2.length > 7) problems.push(`There are ${h2.length} sections. Use 4 to 6.`)
  if (!h2.some((block) => block.t === 'h' && /limit|does not apply|caveat|where this/i.test(plainText([block])))) {
    problems.push('Missing the "Limits" section that holds the caveats.')
  }

  const diagrams = blocks.filter((block) => block.t === 'svg')
  if (diagrams.length < 1) problems.push('Include at least one SVG diagram.')
  for (const block of diagrams) if (block.t === 'svg' && !sanitizeSvg(block.v)) problems.push('A diagram is not valid SVG under the rules. Redraw it with allowed tags only.')

  if (draft.faq.length < 3 || draft.faq.length > 5) problems.push(`There are ${draft.faq.length} FAQ items. Give 3 to 5.`)

  const mentions = (draft.body.match(/devrel\.?\s?studio/gi) ?? []).length
  if (mentions < 1) problems.push('Mention DevRel Studio once, where it fits.')
  if (mentions > 3) problems.push(`DevRel Studio is named ${mentions} times. Name it at most twice.`)

  const all = `${draft.title}\n${draft.description}\n${text}\n${draft.faq.map((item) => `${item.q} ${item.a}`).join('\n')}`
  for (const hit of findSlop(all)) {
    if (hit.rule === 'em dash') continue
    problems.push(`${hit.rule}: "${hit.match}". Rewrite it.`)
  }
  const dashes = (all.match(/—/g) ?? []).length
  if (dashes > 4) problems.push(`${dashes} em dashes. Use at most 4.`)
  if (/\b(you might (think|be wondering|say)|don'?t worry|you'?re not (alone|missing)|you may be wondering)\b/i.test(all)) {
    problems.push('Remove the lines that tell the reader what they think or feel.')
  }

  const sentences = sentencesOf(text.replace(/```[\s\S]*?```/g, ''))
  if (sentences.length > 10) {
    const long = sentences.filter((sentence) => wordCount(sentence) > 30).length
    const short = sentences.filter((sentence) => wordCount(sentence) <= 6).length
    if (long / sentences.length > 0.08) problems.push(`${long} sentences run over 30 words. Split them.`)
    if (short / sentences.length > 0.1) problems.push(`${short} sentences are 6 words or fewer. Join some into connected sentences.`)
  }

  const prose = draft.body.replace(/```[\s\S]*?```/g, ' ')
  const numbers = ungroundedNumbers(`${prose}\n${draft.faq.map((item) => item.a).join('\n')}`, groundTruth)
  const real = numbers.filter((token) => !/^(20\d\d|1|2|3|4|5|6|7|8|9|10|90|100)\b/.test(token.replace(/[^\d.]/g, '')))
  if (real.length) problems.push(`These numbers are not in the facts: ${real.join(', ')}. Remove them or find them in the facts.`)

  return problems
}

export interface Claim {
  claim: string
  verdict: 'verified' | 'unsupported' | 'wrong'
  source_url?: string
  note?: string
}

/** Pulls the JSON object out of a model reply, which may wrap it in prose or a fence. */
export function extractJson<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

export function parseClaims(raw: string): Claim[] | null {
  const data = extractJson<{ claims?: unknown }>(raw)
  if (!data || !Array.isArray(data.claims)) return null
  return data.claims
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item): Claim => ({
      claim: String(item.claim ?? '').slice(0, 400),
      verdict: item.verdict === 'verified' ? 'verified' : item.verdict === 'wrong' ? 'wrong' : 'unsupported',
      source_url: typeof item.source_url === 'string' ? item.source_url.slice(0, 300) : undefined,
      note: typeof item.note === 'string' ? item.note.slice(0, 300) : undefined,
    }))
    .filter((item) => item.claim)
}
