// Checks written for CV text. They encode the patterns the avoid-ai-writing
// skill flags, limited to the ones that show up in CVs and cover notes.

const BANNED_WORDS = [
  'delve', 'leverage', 'leveraging', 'harness', 'harnessing', 'robust', 'seamless', 'seamlessly',
  'tapestry', 'landscape', 'realm', 'testament', 'pivotal', 'crucial', 'vibrant', 'foster',
  'fostering', 'cutting-edge', 'state-of-the-art', 'game-changer', 'game-changing', 'synergy',
  'spearhead', 'spearheaded', 'orchestrate', 'orchestrated', 'passionate', 'dynamic',
  'results-driven', 'detail-oriented', 'thought leader', 'unlock', 'elevate', 'empower',
  'empowering', 'streamline', 'streamlined', 'holistic', 'multifaceted', 'nuanced', 'comprehensive',
  'innovative', 'transformative', 'groundbreaking', 'meticulous', 'myriad', 'plethora', 'embark',
  'navigate', 'underscore', 'underscores', 'showcase', 'showcasing', 'commendable', 'invaluable',
]

const PHRASES: { rule: string; pattern: RegExp }[] = [
  { rule: 'letter opener', pattern: /\bi am (writing|excited|thrilled|delighted) (to|about)\b/i },
  { rule: 'letter opener', pattern: /\bi would like to (express|apply)\b/i },
  { rule: 'chatbot artifact', pattern: /\b(i hope this|great question|as an ai|let me know if)\b/i },
  { rule: 'template phrase', pattern: /\bin today'?s (fast-paced|ever-changing|rapidly evolving)\b/i },
  { rule: 'template phrase', pattern: /\bin the (rapidly evolving|ever-evolving) (world|landscape)\b/i },
  { rule: 'template phrase', pattern: /\b(proven )?track record of\b/i },
  { rule: 'template phrase', pattern: /\bwell-positioned to\b/i },
  { rule: 'template phrase', pattern: /\bat the intersection of\b/i },
  { rule: 'template phrase', pattern: /\bhit the ground running\b/i },
  { rule: 'template phrase', pattern: /\bteam player\b/i },
  { rule: 'closer', pattern: /\b(look forward to (hearing|discussing)|thank you for your (time|consideration))\b/i },
  { rule: 'contrast mirroring', pattern: /\bnot (just|only|merely) [^.;]{1,60}, but (also )?/i },
  { rule: 'contrast mirroring', pattern: /\bit'?s not about [^.;]{1,60}, it'?s about\b/i },
  { rule: 'em dash', pattern: /—/ },
  { rule: 'hedge stack', pattern: /\b(could|may|might) potentially\b/i },
]

export interface SlopHit {
  rule: string
  match: string
}

export function findSlop(text: string): SlopHit[] {
  const hits: SlopHit[] = []
  const lower = text.toLowerCase()
  for (const word of BANNED_WORDS) {
    const pattern = new RegExp(`(^|[^a-z])${word.replace(/[-]/g, '[- ]')}(?![a-z])`, 'i')
    const found = pattern.exec(lower)
    if (found) hits.push({ rule: 'word list', match: word })
  }
  for (const { rule, pattern } of PHRASES) {
    const found = pattern.exec(text)
    if (found) hits.push({ rule, match: found[0].trim() })
  }
  // Three or more short noun-phrase bullets in a row with no verb is the list shape AI favours.
  return hits
}

/** Numbers in the output that do not appear in anything the writer supplied. */
export function ungroundedNumbers(output: string, sources: string[]): string[] {
  const haystack = sources.join('\n').toLowerCase().replace(/,/g, '')
  const found = output.toLowerCase().replace(/,/g, '').match(/\d+(?:\.\d+)?(?:\s?[km]\b|%)?/g) ?? []
  const missing = new Set<string>()
  for (const raw of found) {
    const token = raw.trim()
    const digits = token.replace(/[^\d.]/g, '')
    if (digits.length < 2) continue // "3 talks" style counts are checked below only when large
    if (!haystack.includes(digits)) missing.add(token)
  }
  return [...missing]
}

export const STYLE_RULES = `Write like a person who has done the work and is telling a colleague about it.
- Plain verbs: built, wrote, ran, shipped, taught, fixed, answered. No "spearheaded", "leveraged", "orchestrated".
- State what happened and the outcome. Short and long sentences mixed. Fragments are fine in bullets.
- No adjectives that praise yourself (passionate, dynamic, innovative, results-driven, detail-oriented).
- No em dashes. No "not just X, but Y". No "in today's fast-paced world". No closing line thanking them for their time.
- Do not open the cover note with "I am writing to" or "I am excited to". Open with the most relevant thing you did.
- Never invent a number, employer, tool, title, date or outcome. If the source does not say it, leave it out.
- Do not add a personality the source does not show: no "I've always been passionate", no "in my experience" unless the CV says it.
- First person in the cover note. CV bullets have no subject: "Wrote...", "Cut...".`
