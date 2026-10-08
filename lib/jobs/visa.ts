// Visa sponsorship, read from the listing text.
//
// Most postings never say either way, so the answer has three states and the
// third one is the common one:
//   'yes'      the text offers sponsorship, or visa or immigration support
//   'no'       the text says the employer cannot or will not sponsor
//   undefined  the text does not say
//
// A refusal beats an offer. A listing that says "we sponsor visas for some roles,
// but cannot sponsor for this one" must not appear under a sponsorship filter.
// "Must be authorised to work" is only a weak refusal, so an offer outranks it.

export type VisaStatus = 'yes' | 'no'

const REFUSE = [
  /\b(?:unable|not able|cannot|can ?not|can'?t|won'?t|will not|do not|does not|don'?t|doesn'?t|not currently able|not in a position|not (?:able )?to offer|not offer(?:ing)?|not provid(?:e|ing)|not willing)\b\s+(?:to\s+)?(?:\w+\s+){0,4}?(?:sponsor\w*|visas?\b)/i,
  /\bno (?:visa |immigration |work (?:visa|permit) )?sponsorship\b/i,
  /\bsponsorship (?:is |are )?(?:not|un)(?:available|offered|provided)\b/i,
  /\b(?:visa )?sponsorship (?:is )?not (?:available|offered|provided|possible)\b/i,
  /\bnot (?:eligible|available) for (?:visa |work )?sponsorship\b/i,
  /\bwithout (?:the need for |requiring |needing )?(?:visa |employer |company )?sponsorship\b/i,
  /\bnot (?:be )?sponsor(?:ing)?\b/i,
]

const WEAK_REFUSE = [
  /\bmust (?:already )?(?:have|hold|possess) (?:the )?(?:legal |existing |valid )?right to work\b/i,
  /\bmust be (?:legally )?(?:authori[sz]ed|eligible|permitted) to work\b/i,
  /\b(?:authori[sz]ation|eligibility|right) to work in the (?:u\.?s\.?|united states|uk|united kingdom|eu|canada)\b.{0,40}\b(?:required|must)\b/i,
]

const OFFER = [
  /\b(?:visa|work permit|work authori[sz]ation|immigration)\s+(?:sponsorship|support|assistance|help)\b/i,
  /\bsponsor(?:s|ing)?\s+(?:your |a |an |the |work |employment |skilled worker )*(?:visas?|work permits?|immigration)\b/i,
  /\b(?:we|will|can|could|able to|happy to|willing to|glad to|ready to|offer to)\s+(?:\w+\s+){0,3}?sponsor\b/i,
  /\bsponsorship\s+(?:is |may be |can be )?(?:available|offered|provided|possible|on offer)\b/i,
  /\b(?:visa|immigration)\s+(?:is |are |can be |will be )?(?:provided|available|offered|handled|covered)\b/i,
  /\bsponsor(?:ship)? (?:for )?(?:a |your )?(?:work )?visa\b/i,
  /\bskilled worker (?:visa|sponsor)/i,
  /\bhighly skilled (?:migrant|worker)\b/i,
  /\bh-?1b\s+(?:transfer|sponsor\w*)/i,
  /\beu blue card\b/i,
  /\blicen[sc]ed (?:visa )?sponsor\b/i,
  /\bwe (?:handle|cover|arrange|take care of) (?:your |all )?(?:visa|immigration|work permit)/i,
]

const any = (patterns: RegExp[], text: string) => patterns.some((pattern) => pattern.test(text))

export function detectVisa(text: string): VisaStatus | undefined {
  if (!text) return undefined
  const sample = text.replace(/\s+/g, ' ')
  if (any(REFUSE, sample)) return 'no'
  if (any(OFFER, sample)) return 'yes'
  if (any(WEAK_REFUSE, sample)) return 'no'
  return undefined
}

export const VISA_LABEL: Record<VisaStatus, string> = {
  yes: 'Visa sponsorship',
  no: 'No visa sponsorship',
}
