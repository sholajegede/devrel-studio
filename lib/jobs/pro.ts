// Jobs Pro: the paid side of the job board. Sold as a 12 month pass through
// the same manual transfer flow as the workspace plans, because card payments
// are not available. Pure, so the Convex gate and the UI read the same rules.

export const FREE_TAILORINGS = 3
/** Fair use for paid accounts. Every tailoring is a model call that costs money. */
export const PRO_TAILORINGS_PER_MONTH = 60
export const PRO_MONTHS = 12
export const FREE_ALERT_LIMIT = 2
export const PRO_ALERT_LIMIT = 50

export const PRO_PRICE: Record<'USD' | 'GBP' | 'NGN', number> = {
  USD: 49,
  GBP: 39,
  NGN: 75_000,
}

export const PRO_FEATURES = [
  'Tailored CV bullets and a cover note for every role, built from your own published work',
  'Instant alerts the moment a matching role is posted, and up to 50 saved alerts',
  'Pay benchmarks for your exact role, level and region',
  'Hiring view: who hires repeatedly and which roles have stayed open longest',
] as const

export interface ProUser {
  comped?: boolean
  jobsProUntil?: number
}

export function proActive(user: ProUser | null | undefined, now: number = Date.now()): boolean {
  if (!user) return false
  if (user.comped) return true
  return typeof user.jobsProUntil === 'number' && user.jobsProUntil > now
}

export interface TailorGate {
  allowed: boolean
  reason: 'ok' | 'free-used-up' | 'fair-use'
  freeLeft: number
  monthLeft: number | null
}

/**
 * `used` counts every kit ever made and `usedThisMonth` the last 30 days.
 * Failed generations are not counted by the caller.
 */
export function tailorGate(input: { pro: boolean; used: number; usedThisMonth: number }): TailorGate {
  if (input.pro) {
    const monthLeft = Math.max(0, PRO_TAILORINGS_PER_MONTH - input.usedThisMonth)
    return {
      allowed: monthLeft > 0,
      reason: monthLeft > 0 ? 'ok' : 'fair-use',
      freeLeft: 0,
      monthLeft,
    }
  }
  const freeLeft = Math.max(0, FREE_TAILORINGS - input.used)
  return {
    allowed: freeLeft > 0,
    reason: freeLeft > 0 ? 'ok' : 'free-used-up',
    freeLeft,
    monthLeft: null,
  }
}

export function alertLimit(pro: boolean): number {
  return pro ? PRO_ALERT_LIMIT : FREE_ALERT_LIMIT
}

export function canUseFrequency(pro: boolean, frequency: string): boolean {
  return frequency === 'instant' ? pro : frequency === 'daily' || frequency === 'weekly'
}
