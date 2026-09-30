// Whether a tour should start by itself. Three places remember: this browser,
// the signed-in account, and a hashed IP address kept on the server. A tour
// that any of them has seen through never starts by itself again, and no tour
// starts by itself more than three times. The Tour button always works.

export const MAX_AUTO_RUNS = 3

export interface TourMemory {
  runs: number
  done: boolean
}

export const EMPTY_MEMORY: TourMemory = { runs: 0, done: false }

export function mergeMemory(...parts: (TourMemory | null | undefined)[]): TourMemory {
  let runs = 0
  let done = false
  for (const part of parts) {
    if (!part) continue
    runs = Math.max(runs, part.runs)
    done = done || part.done
  }
  return { runs, done }
}

export function shouldAutoStart(...parts: (TourMemory | null | undefined)[]): boolean {
  const merged = mergeMemory(...parts)
  return !merged.done && merged.runs < MAX_AUTO_RUNS
}

export const TOUR_IDS = ['jobs-public', 'jobs-discover', 'jobs-tracker'] as const
export type TourId = (typeof TOUR_IDS)[number]

export function isTourId(value: unknown): value is TourId {
  return typeof value === 'string' && (TOUR_IDS as readonly string[]).includes(value)
}

// ── This browser ──────────────────────────────────────────────────────────────

const KEY = (tour: string) => `devrel-tour-memory-v1:${tour}`

export function readBrowserMemory(tour: string): TourMemory {
  try {
    const raw = window.localStorage.getItem(KEY(tour))
    if (!raw) return EMPTY_MEMORY
    const data = JSON.parse(raw) as Partial<TourMemory>
    return { runs: Number.isFinite(data.runs) ? Number(data.runs) : 0, done: data.done === true }
  } catch {
    return EMPTY_MEMORY
  }
}

export function writeBrowserMemory(tour: string, memory: TourMemory): void {
  try {
    window.localStorage.setItem(KEY(tour), JSON.stringify(memory))
  } catch {
    // Private windows can refuse storage. The server copy still holds.
  }
}
