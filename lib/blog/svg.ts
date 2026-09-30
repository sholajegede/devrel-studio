// Diagrams come from a model, so they are treated as untrusted. This keeps a
// fixed set of drawing tags and attributes, and drops everything else: scripts,
// event handlers, styles that load things, links and embedded documents.

const TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
  'defs', 'marker', 'title', 'desc', 'linearGradient', 'stop',
])

const ATTRS = new Set([
  'viewBox', 'width', 'height', 'xmlns', 'role', 'aria-label', 'aria-labelledby', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'text-anchor', 'dominant-baseline',
  'font-size', 'font-weight', 'font-family', 'id', 'marker-end', 'marker-start', 'markerWidth', 'markerHeight',
  'refX', 'refY', 'orient', 'markerUnits', 'offset', 'stop-color', 'stop-opacity', 'preserveAspectRatio', 'class',
  'gradientUnits', 'x-', 'dy', 'dx',
])

const SAFE_VALUE = /^[\w\s.,#%()\-+:/'"°]*$/

function cleanValue(name: string, value: string): string | null {
  if (!SAFE_VALUE.test(value)) return null
  if (/url\(/i.test(value)) return /^url\(#[\w-]+\)$/.test(value.trim()) ? value : null
  if (/javascript:|data:|expression/i.test(value)) return null
  if (name === 'class') return null
  return value
}

/**
 * Returns a cleaned SVG string, or null when the input is not one SVG document
 * or contains anything outside the allowlist that cannot simply be dropped.
 */
export function sanitizeSvg(input: string): string | null {
  const source = input.trim()
  if (!/^<svg[\s>]/i.test(source) || !/<\/svg>\s*$/i.test(source)) return null
  if (source.length > 40_000) return null
  if (/<!|<\?|<script|<foreignObject|<style|<image|<use|<a[\s>]|<iframe|<animate|<set[\s>]/i.test(source)) return null

  let ok = true
  const cleaned = source.replace(/<(\/?)([a-zA-Z][\w:-]*)([^<>]*?)(\/?)>/g, (_match, close: string, tag: string, attrs: string, selfClose: string) => {
    if (!TAGS.has(tag)) {
      ok = false
      return ''
    }
    if (close) return `</${tag}>`
    const kept: string[] = []
    const pattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g
    let found: RegExpExecArray | null
    while ((found = pattern.exec(attrs)) !== null) {
      const name = found[1]
      const value = found[3] ?? found[4] ?? ''
      if (/^on/i.test(name) || /^xlink:/i.test(name) || name === 'href' || name === 'style') continue
      if (!ATTRS.has(name)) continue
      const safe = cleanValue(name, value)
      if (safe !== null) kept.push(`${name}="${safe.replace(/"/g, '&quot;')}"`)
    }
    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}${selfClose ? ' /' : ''}>`
  })
  if (!ok) return null

  // Every `<` must open a tag this function wrote. Anything else is dropped.
  if (cleaned.replace(/<\/?[a-zA-Z][^<>]*>/g, '').includes('<')) return null

  // Text inside the drawing is data, never markup.
  return cleaned.replace(/>([^<]+)</g, (_m, text: string) => `>${text.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;')}<`)
}
