import { categoryOf, getMetricLabel, previousMonth } from './metrics'
import { buildReport, periodLabel, type ReportEntry } from './report'
import { findSlop, STYLE_RULES, ungroundedNumbers } from './jobs/slop'

// ── The report agent ──────────────────────────────────────────────────────────
//
// Drafts the written half of a monthly report: the summary, what drove the
// numbers, and the answer to last month's feedback. It reads the same figures
// the report shows, and every number it writes is checked against them before
// the draft reaches the DevRel.
//
// Pure on purpose. The Convex action gathers rows and calls the model; this
// file builds the prompt, parses the reply and judges it, so the rules can be
// tested without a network.

export interface AgentInput {
  clientName: string
  period: string
  entries: readonly ReportEntry[]
  priorFeedback: { comment: string; rating?: number }[]
  targets: { reach: number | null; published: number | null }
}

export interface AgentDraft {
  summary: string
  performanceNote: string
  responseToFeedback: string
}

const fmt = (n: number) => n.toLocaleString('en-US')

function change(current: number, previous: number): string {
  const delta = current - previous
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : ''
  const base = `${sign}${fmt(Math.abs(delta))}`
  if (previous <= 0) return base
  const percent = Math.round((Math.abs(delta) / previous) * 100)
  return `${base} (${sign}${percent}%)`
}

/**
 * Every fact the agent may use, one per line.
 *
 * Differences and percentages are worked out here rather than left to the
 * model, which gets arithmetic wrong, and which would otherwise write numbers
 * that appear nowhere in the data.
 */
export function agentFacts(input: AgentInput): string {
  const report = buildReport(input.entries, input.period)
  const prior = previousMonth(input.period)
  const lines: string[] = []

  lines.push(`Client: ${input.clientName}`)
  lines.push(`Period: ${report.label}`)
  lines.push(`Pieces published in ${report.label}: ${report.totals.published}`)
  lines.push(`Pieces published in ${periodLabel(prior)}: ${report.previous.published}`)
  lines.push(`Reach in ${report.label}: ${fmt(report.reach)}`)
  lines.push(`Reach in ${periodLabel(prior)}: ${fmt(report.previousReach)}`)
  lines.push(`Change in reach: ${change(report.reach, report.previousReach)}`)
  lines.push(`Views: ${fmt(report.totals.views)}. Attendees: ${fmt(report.totals.attendees)}. Downloads: ${fmt(report.totals.downloads)}. Stars: ${fmt(report.totals.stars)}.`)
  lines.push(`Reshares: ${report.reshareCount}`)

  if (input.targets.reach !== null) {
    lines.push(`Reach target: ${fmt(input.targets.reach)}. Reached ${Math.round((report.reach / Math.max(input.targets.reach, 1)) * 100)}% of it.`)
  }
  if (input.targets.published !== null) {
    lines.push(`Published target: ${fmt(input.targets.published)}. Published ${report.totals.published}.`)
  }

  for (const row of report.byCategory) {
    lines.push(`Category ${row.category}: ${row.count} piece${row.count === 1 ? '' : 's'}, ${fmt(row.metric)} total`)
  }
  for (const [index, item] of report.highlights.entries()) {
    const label = getMetricLabel(categoryOf(item.entry)).toLowerCase()
    lines.push(`Top piece ${index + 1}: "${item.entry.title}" on ${item.entry.platform}, ${fmt(item.metric)} ${label}`)
  }
  for (const item of report.upcoming.slice(0, 5)) {
    lines.push(`Coming up: "${item.title}" (${item.status}, ${item.publicationDate})`)
  }
  for (const item of input.priorFeedback.slice(0, 3)) {
    lines.push(`Client feedback last period${item.rating ? ` (rated ${item.rating} of 5)` : ''}: "${item.comment}"`)
  }

  return lines.join('\n')
}

export function hasPublishedWork(input: AgentInput): boolean {
  return buildReport(input.entries, input.period).totals.published > 0
}

const SYSTEM = `You are the report agent inside DevRel Studio. A developer advocate sends a monthly report to a client or an executive sponsor. You draft the written part. The advocate reads, edits and sends it, so write what they would be glad to put their name to.

Rules:
- Use only the facts you are given. Every number you write must appear in the facts, and you may not do arithmetic of your own.
- State what the data shows. Do not claim a cause the data cannot show. Never write that a post "went viral", "was picked up by" a site, or "drove" signups. If the facts do not say why reach moved, say which piece led and how the mix changed.
- Name the pieces by title when you cite them.
- If a target is given, say plainly whether it was met.
- If there is feedback from last period, answer it in one or two sentences that say what was done about it. If there is none, return an empty string for responseToFeedback.
- Write for a reader who will give it thirty seconds.

${STYLE_RULES}

Reply with one JSON object and nothing else:
{"summary": "...", "performanceNote": "...", "responseToFeedback": "..."}
summary: two short paragraphs at most, separated by a blank line, under 900 characters.
performanceNote: one or two sentences, under 300 characters, on why the numbers moved as far as the data shows.
responseToFeedback: under 500 characters.`

export function buildAgentPrompt(input: AgentInput): { system: string; user: string } {
  return {
    system: SYSTEM,
    user: `Facts for this report:\n\n${agentFacts(input)}\n\nDraft the three parts.`,
  }
}

export function repairAgentPrompt(draft: AgentDraft, problems: string[]): string {
  return `Your draft had problems:\n${problems.map((problem) => `- ${problem}`).join('\n')}\n\nCurrent draft:\n${JSON.stringify(draft)}\n\nFix every problem and reply with the corrected JSON object only.`
}

/** Pulls the JSON object out of a reply, which may be wrapped in a code fence. */
export function parseAgentDraft(text: string): AgentDraft | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const read = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : '')
    const draft: AgentDraft = {
      summary: read('summary').slice(0, 4000),
      performanceNote: read('performanceNote').slice(0, 600),
      responseToFeedback: read('responseToFeedback').slice(0, 1200),
    }
    return draft.summary ? draft : null
  } catch {
    return null
  }
}

/**
 * What is wrong with a draft, in words the model can act on. Empty means clean.
 *
 * Two checks: the house list of phrases that read as machine-written, and
 * numbers that appear nowhere in the facts.
 */
export function checkAgentDraft(draft: AgentDraft, facts: string): string[] {
  const text = [draft.summary, draft.performanceNote, draft.responseToFeedback].join('\n')
  const problems = findSlop(text).map((hit) => `${hit.rule}: "${hit.match}". Rewrite it plainly.`)
  const numbers = ungroundedNumbers(text, [facts])
  if (numbers.length > 0) {
    problems.push(`numbers that are not in the facts: ${numbers.join(', ')}. Remove them or use only given figures.`)
  }
  return problems
}
