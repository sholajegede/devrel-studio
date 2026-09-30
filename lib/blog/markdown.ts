// A small Markdown reader for the blog. It understands only what the writer is
// told to produce, and it never emits raw HTML: every text run is data.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] }

export type Block =
  | { t: 'h'; level: 2 | 3; id: string; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] }
  | { t: 'quote'; c: Inline[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'svg'; v: string; caption?: string }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'hr' }

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 70)
}

/** Only http(s), mailto and site paths. Anything else becomes plain text. */
export function safeHref(href: string): string | null {
  const value = href.trim()
  if (value.startsWith('/') && !value.startsWith('//')) return value
  if (value.startsWith('#')) return value
  if (/^(https?:|mailto:)/i.test(value)) return value
  return null
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  let rest = source
  const push = (value: string) => {
    if (value) out.push({ t: 'text', v: value })
  }
  while (rest.length > 0) {
    const code = /^`([^`]+)`/.exec(rest)
    if (code) {
      out.push({ t: 'code', v: code[1] })
      rest = rest.slice(code[0].length)
      continue
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest)
    if (link) {
      const href = safeHref(link[2])
      if (href) out.push({ t: 'link', href, c: parseInline(link[1]) })
      else push(link[1])
      rest = rest.slice(link[0].length)
      continue
    }
    const strong = /^\*\*([^*]+)\*\*/.exec(rest)
    if (strong) {
      out.push({ t: 'strong', c: parseInline(strong[1]) })
      rest = rest.slice(strong[0].length)
      continue
    }
    const em = /^\*([^*\s][^*]*)\*/.exec(rest) ?? /^_([^_\s][^_]*)_(?![a-z0-9])/i.exec(rest)
    if (em) {
      out.push({ t: 'em', c: parseInline(em[1]) })
      rest = rest.slice(em[0].length)
      continue
    }
    const next = rest.slice(1).search(/[`[*_]/)
    const cut = next === -1 ? rest.length : next + 1
    push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  return out
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index++
      continue
    }

    const fence = /^```(\w*)\s*$/.exec(line)
    if (fence) {
      const body: string[] = []
      index++
      while (index < lines.length && !/^```\s*$/.test(lines[index])) body.push(lines[index++])
      index++
      const lang = fence[1].toLowerCase()
      if (lang === 'svg') {
        // A caption may follow on the next line as *Figure: ...*
        const captionMatch = /^\*(.+)\*\s*$/.exec(lines[index] ?? '')
        if (captionMatch) index++
        blocks.push({ t: 'svg', v: body.join('\n'), caption: captionMatch?.[1] })
      } else {
        blocks.push({ t: 'code', lang, v: body.join('\n') })
      }
      continue
    }

    const heading = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      const text = heading[2]
      blocks.push({ t: 'h', level: heading[1].length === 2 ? 2 : 3, id: slugify(text), c: parseInline(text) })
      index++
      continue
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ t: 'hr' })
      index++
      continue
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) body.push(lines[index++].replace(/^>\s?/, ''))
      blocks.push({ t: 'quote', c: parseInline(body.join(' ')) })
      continue
    }

    if (/^\|.+\|\s*$/.test(line) && /^\|?\s*:?-+:?\s*\|/.test(lines[index + 1] ?? '')) {
      const head = cells(line).map(parseInline)
      index += 2
      const rows: Inline[][][] = []
      while (index < lines.length && /^\|.+\|\s*$/.test(lines[index])) rows.push(cells(lines[index++]).map(parseInline))
      blocks.push({ t: 'table', head, rows })
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: Inline[][] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) items.push(parseInline(lines[index++].replace(/^\s*[-*]\s+/, '')))
      blocks.push({ t: 'ul', items })
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: Inline[][] = []
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) items.push(parseInline(lines[index++].replace(/^\s*\d+[.)]\s+/, '')))
      blocks.push({ t: 'ol', items })
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(```|#{2,3}\s|>\s?|\s*[-*]\s+|\s*\d+[.)]\s+|-{3,}\s*$)/.test(lines[index])
    ) {
      paragraph.push(lines[index++].trim())
    }
    if (paragraph.length === 0) {
      index++
      continue
    }
    blocks.push({ t: 'p', c: parseInline(paragraph.join(' ')) })
  }
  return blocks
}

export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((node) => (node.t === 'text' || node.t === 'code' ? node.v : inlineText(node.c)))
    .join('')
}

/** Plain text of a post, for word counts, checks and the feed summary. */
export function plainText(blocks: Block[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.t === 'h' || block.t === 'p' || block.t === 'quote') parts.push(inlineText(block.c))
    else if (block.t === 'ul' || block.t === 'ol') for (const item of block.items) parts.push(inlineText(item))
    else if (block.t === 'table') {
      parts.push(block.head.map(inlineText).join(' '))
      for (const row of block.rows) parts.push(row.map(inlineText).join(' '))
    }
  }
  return parts.join('\n')
}

export const wordCount = (text: string): number => (text.match(/\b[\w'-]+\b/g) ?? []).length
export const readingMinutes = (words: number): number => Math.max(1, Math.round(words / 220))
