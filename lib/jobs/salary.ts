export interface SalaryRange {
  min: number
  max: number
  currency: string
}

const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.66,
  NZD: 0.6,
  CHF: 1.12,
  SEK: 0.095,
  NOK: 0.093,
  DKK: 0.145,
  PLN: 0.25,
  INR: 0.012,
  SGD: 0.74,
  JPY: 0.0067,
  BRL: 0.18,
  MXN: 0.052,
  NGN: 0.00065,
  ZAR: 0.055,
  AED: 0.27,
}

export function toUsd(amount: number, currency: string): number | null {
  const rate = USD_RATES[currency.toUpperCase()]
  return rate ? Math.round(amount * rate) : null
}

const SYMBOLS: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP' }
const CODES = Object.keys(USD_RATES).join('|')
const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?([kK])?`

const RANGE = new RegExp(
  String.raw`(?:(${CODES})\s?|([$€£])\s?(?:(${CODES})\s?)?)${AMOUNT}\s?(?:-|–|—|to)\s?(?:(?:${CODES}|[$€£])\s?)?${AMOUNT}(?:\s?(${CODES}))?`,
  'g',
)

function scale(raw: string, k: string | undefined): number {
  const value = Number(raw.replace(/,/g, ''))
  return k ? value * 1000 : value
}

function plausible(range: SalaryRange): boolean {
  const min = toUsd(range.min, range.currency)
  const max = toUsd(range.max, range.currency)
  if (min === null || max === null) return false
  return range.max >= range.min && min >= 12_000 && max <= 1_500_000
}

export function parseSalaryText(text: string): SalaryRange | null {
  RANGE.lastIndex = 0
  const candidates: SalaryRange[] = []
  let match: RegExpExecArray | null

  while ((match = RANGE.exec(text)) !== null) {
    const currency = (
      match[1] ??
      match[3] ??
      match[8] ??
      SYMBOLS[match[2] ?? ''] ??
      'USD'
    ).toUpperCase()
    let min = scale(match[4], match[5])
    let max = scale(match[6], match[7])
    const around = text.slice(match.index, match.index + 140)

    if (max < 1000 && /\b(per hour|\/ ?hr|hourly|an hour)\b/i.test(around)) {
      min = Math.round(min * 2080)
      max = Math.round(max * 2080)
    } else if (max < 1000) {
      continue
    }

    const range = { min, max, currency }
    if (plausible(range)) candidates.push(range)
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => (toUsd(b.max, b.currency) ?? 0) - (toUsd(a.max, a.currency) ?? 0))
  return candidates[0]
}

export function parseStructuredSalary(input: {
  min?: number | null
  max?: number | null
  currency?: string | null
  interval?: string | null
}): SalaryRange | null {
  if (!input.min && !input.max) return null
  const currency = (input.currency ?? 'USD').toUpperCase()
  const interval = (input.interval ?? 'year').toLowerCase()
  const factor = (value: number) =>
    /hour/.test(interval) ? value * 2080 : /month/.test(interval) ? value * 12 : value
  const a = Math.round(factor(input.min ?? input.max ?? 0))
  const b = Math.round(factor(input.max ?? input.min ?? 0))
  const range = { min: Math.min(a, b), max: Math.max(a, b), currency }
  return plausible(range) ? range : null
}

export function formatSalary(range: SalaryRange): string {
  const symbol = ({ USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[range.currency]
  const prefix = symbol ?? `${range.currency} `
  const short = (value: number) =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value))
  return range.min === range.max
    ? `${prefix}${short(range.min)}`
    : `${prefix}${short(range.min)} – ${prefix}${short(range.max)}`
}
