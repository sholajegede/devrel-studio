// ── External stat sources ─────────────────────────────────────────────────────
//
// The parsing and date arithmetic behind convex/sync.ts, kept free of Convex
// imports so it can be exercised directly in tests. The network calls stay in
// sync.ts; everything here is pure.

/** npm's point endpoint rejects any range longer than 18 months. */
export const MAX_RANGE_MONTHS = 17

/** Walking back further than this is a runaway, not a very old package. */
export const MAX_DOWNLOAD_CHUNKS = 24

/** npm has no download data before this date, so there is nothing to ask for. */
export const NPM_EPOCH = '2015-01-10'

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Split the window between `start` and `now` into ranges npm will accept.
 *
 * Returned newest-first, contiguous and non-overlapping: each range ends the day
 * before the previous one begins. Overlapping by even a day would double-count
 * that day's downloads into the all-time total.
 *
 * `start` is clamped to the npm epoch, so a package whose registry metadata is
 * missing or nonsense cannot produce thousands of pointless requests.
 */
export function downloadRanges(
  start: Date,
  now: Date,
  maxChunks: number = MAX_DOWNLOAD_CHUNKS,
): { from: string; to: string }[] {
  const floor = Math.max(start.getTime(), Date.parse(NPM_EPOCH))
  const begin = new Date(floor)

  const ranges: { from: string; to: string }[] = []
  let cursor = new Date(now)

  while (cursor > begin && ranges.length < maxChunks) {
    const chunkStart = new Date(cursor)
    chunkStart.setMonth(chunkStart.getMonth() - MAX_RANGE_MONTHS)
    const from = chunkStart < begin ? begin : chunkStart

    ranges.push({ from: isoDate(from), to: isoDate(cursor) })

    // Step back one day so the next range ends where this one starts, exclusive.
    cursor = new Date(from)
    cursor.setDate(cursor.getDate() - 1)
  }

  return ranges
}

/**
 * Pull `owner/repo` out of any of the shapes people paste into the form:
 * full https URLs, `git@github.com:` SSH remotes, `git+https` package metadata,
 * a bare `github.com/owner/repo`, or just `owner/repo`.
 *
 * Returns null for anything not on GitHub, so a GitLab URL fails closed rather
 * than being sent to the GitHub API as a nonsense path.
 */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')

  // A bare `owner/repo` has no host to parse, and prefixing it with https://
  // would make `owner` look like the hostname. Match it directly instead.
  const bare = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)$/.exec(
    cleaned,
  )
  if (bare) {
    return { owner: bare[1], repo: bare[2] }
  }

  const withProtocol = /^https?:\/\//.test(cleaned)
    ? cleaned
    : `https://${cleaned.replace(/^github\.com\//, 'github.com/')}`

  let path: string
  try {
    const url = new URL(withProtocol)
    // endsWith rather than equality so www.github.com resolves too — but it must
    // be a dot boundary, or `evilgithub.com` would pass.
    if (url.hostname !== 'github.com' && !url.hostname.endsWith('.github.com')) {
      return null
    }
    path = url.pathname
  } catch {
    return null
  }

  const [owner, repo] = path.split('/').filter(Boolean)
  if (!owner || !repo) return null

  return { owner, repo }
}
