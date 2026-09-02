import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ── Reading Convex functions as source ────────────────────────────────────────
//
// Several of the admin console's security invariants fail by *omission* — a
// guard that is not called, an audit row that is not written, a transaction
// split in two. There is no Convex test harness in this repo, and even with one
// a missing line is hard to assert on at runtime: the function does something
// perfectly reasonable, just not the thing that was required.
//
// So these tests read the source. Crude, and it catches the exact mistake a
// tired person makes at the end of a branch — copying a sibling function and
// losing its first line.
//
// Shared between the phase-one/two tests and the phase-three ones so a new
// admin file is covered by both without anybody remembering to add it.

const root = process.cwd()

export function readConvex(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

/**
 * Every Convex module holding admin functions.
 *
 * Discovered rather than listed. A hand-maintained array is one more thing to
 * update when the console is split across files, and the failure mode of
 * forgetting is silent: the new file is simply never checked, which is the same
 * outcome as the invariant not existing.
 */
export function adminFiles(): string[] {
  return readdirSync(join(root, 'convex'))
    .filter((name) => /^admin.*\.ts$/.test(name))
    .map((name) => `convex/${name}`)
    .sort()
}

export interface ConvexFunction {
  name: string
  kind: string
  /** The declaration, up to the next top-level export. */
  body: string
}

/** Exported Convex functions in one module, with their bodies. */
export function exportedFunctions(source: string): ConvexFunction[] {
  const found: ConvexFunction[] = []
  const pattern =
    /export const (\w+) = (internalMutation|internalQuery|mutation|query|action|internalAction)\(/g

  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    pattern.lastIndex = match.index + match[0].length
    const next = source.indexOf('\nexport const ', match.index + 1)
    found.push({
      name: match[1],
      kind: match[2],
      body: source.slice(match.index, next === -1 ? source.length : next),
    })
  }
  return found
}

/** One module's functions, keyed by name, for a test that wants a specific one. */
export function functionsIn(relativePath: string): Map<string, ConvexFunction> {
  return new Map(exportedFunctions(readConvex(relativePath)).map((fn) => [fn.name, fn]))
}
