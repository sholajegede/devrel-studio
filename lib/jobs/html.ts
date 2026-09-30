const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', middot: '·',
  copy: '©', reg: '®', trade: '™', eacute: 'é', euro: '€', pound: '£',
}

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole
    }
    return NAMED[body.toLowerCase()] ?? whole
  })
}

export function htmlToText(html: string): string {
  let text = html
  if (!/<[a-z][\s\S]*>/i.test(text) && /&lt;[a-z]/i.test(text)) text = decodeEntities(text)

  text = text
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*h[1-6][^>]*>/gi, '\n\n## ')
    .replace(/<\/\s*h[1-6]\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*(p|div|ul|ol|section|tr|table|blockquote)\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')

  return decodeEntities(text)
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export interface DescriptionBlock {
  kind: 'heading' | 'paragraph' | 'list'
  text?: string
  items?: string[]
}

export function textToBlocks(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = []
  for (const chunk of text.split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) continue
    let list: string[] = []
    const flush = () => {
      if (list.length) blocks.push({ kind: 'list', items: list })
      list = []
    }
    for (const line of lines) {
      if (line.startsWith('## ')) {
        flush()
        blocks.push({ kind: 'heading', text: line.slice(3) })
      } else if (line.startsWith('• ')) {
        list.push(line.slice(2))
      } else {
        flush()
        blocks.push({ kind: 'paragraph', text: line })
      }
    }
    flush()
  }
  return blocks
}

export function summarise(text: string, length = 280): string {
  const flat = text.replace(/^## .*$/gm, '').replace(/[•\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (flat.length <= length) return flat
  const cut = flat.slice(0, length)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`
}
