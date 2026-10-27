// ── Autonomy ──────────────────────────────────────────────────────────────────
//
// What each agent may do on its own is a setting per kind of action, not one
// switch. Three levels:
//
//   ask      the agent proposes; a person does the action
//   approve  the agent prepares the whole action; one click sends it
//   auto     the agent acts and logs; a person can review or undo later
//
// Limits live here, in code, and are enforced on the server. A prompt is never
// the only thing standing between an agent and an action.
//
// Pure on purpose: no Convex, no React. The settings screen and the mutations
// read the same table, so what the screen promises is what the server allows.

export type Level = 'ask' | 'approve' | 'auto'
export const LEVELS: readonly Level[] = ['ask', 'approve', 'auto']

export type Preset = 'careful' | 'balanced' | 'hands-off'
export const PRESETS: readonly Preset[] = ['careful', 'balanced', 'hands-off']
export const DEFAULT_PRESET: Preset = 'careful'

const RANK: Record<Level, number> = { ask: 0, approve: 1, auto: 2 }

export const PRESET_COPY: Record<Preset, { label: string; description: string }> = {
  careful: {
    label: 'Careful',
    description: 'The agents propose everything. You approve each action.',
  },
  balanced: {
    label: 'Balanced',
    description:
      'Agents refresh numbers and run tests alone. You approve entries, drafts and sends.',
  },
  'hands-off': {
    label: 'Hands-off',
    description:
      'Adds automatic entries from trusted sources and automatic docs comments. Sends to clients still need an approver.',
  },
}

export type ActionClassKey =
  | 'ingest.read'
  | 'entry.create'
  | 'entry.stats'
  | 'report.draft'
  | 'report.send'
  | 'content.draft'
  | 'content.publish'
  | 'docs.comment'
  | 'readiness.run'
  | 'settings.change'

export interface ActionClass {
  key: ActionClassKey
  label: string
  description: string
  /** The highest level the product will ever allow for this class. */
  maxLevel: Level
  /**
   * Whether Auto actually runs anything today. A class can allow Auto in
   * principle while the agent that would use it has not shipped; letting the
   * owner pick Auto then would promise behaviour that does not exist.
   */
  autoReady: boolean
  /** Whether the class does anything yet. Shown, but not editable, until it does. */
  available: boolean
  /** The roadmap phase that makes it available. */
  phase: number
  note?: string
}

export const ACTION_CLASSES: readonly ActionClass[] = [
  {
    key: 'ingest.read',
    label: 'Read from connected sources',
    description: 'Read posts, videos, repos and signups from accounts you connect. Read-only access.',
    maxLevel: 'auto',
    autoReady: true,
    available: false,
    phase: 1,
  },
  {
    key: 'entry.create',
    label: 'Add an entry to Work',
    description: 'Turn something an agent found, or a proposal you write, into an entry.',
    maxLevel: 'auto',
    autoReady: false,
    available: true,
    phase: 0,
    note: 'Auto starts working when Scout ships, and only for sources you mark as trusted.',
  },
  {
    key: 'entry.stats',
    label: 'Update numbers on an entry',
    description: 'Refresh views, downloads and stars from the source.',
    maxLevel: 'auto',
    autoReady: true,
    available: false,
    phase: 1,
    note: 'The daily npm and GitHub sync already does this.',
  },
  {
    key: 'report.draft',
    label: 'Draft a report write-up',
    description: 'Write the summary and notes for a monthly report. Never saved without you.',
    maxLevel: 'approve',
    autoReady: false,
    available: false,
    phase: 4,
  },
  {
    key: 'report.send',
    label: 'Send a report to a client',
    description: 'Email the report. You cannot unsend it, so it always needs a named approver.',
    maxLevel: 'auto',
    autoReady: false,
    available: false,
    phase: 4,
  },
  {
    key: 'content.draft',
    label: 'Draft a post or brief',
    description: 'Write a draft in the program’s voice. Never published by an agent.',
    maxLevel: 'approve',
    autoReady: false,
    available: false,
    phase: 4,
  },
  {
    key: 'content.publish',
    label: 'Publish to an outside platform',
    description: 'Post to dev.to, YouTube or any other site.',
    maxLevel: 'ask',
    autoReady: false,
    available: false,
    phase: 4,
    note: 'Human-only. The platform will not publish for you.',
  },
  {
    key: 'docs.comment',
    label: 'Comment on a docs pull request',
    description: 'Post a non-blocking review on a pull request that changes your docs.',
    maxLevel: 'auto',
    autoReady: false,
    available: false,
    phase: 5,
  },
  {
    key: 'readiness.run',
    label: 'Run an Agent Readiness test',
    description: 'Test your own docs with an agent in a sandbox, within a budget.',
    maxLevel: 'auto',
    autoReady: false,
    available: false,
    phase: 2,
  },
  {
    key: 'settings.change',
    label: 'Change a connector, role or billing',
    description: 'Always a person.',
    maxLevel: 'ask',
    autoReady: false,
    available: true,
    phase: 0,
    note: 'Fixed. No agent can do this.',
  },
]

const BY_KEY = new Map<string, ActionClass>(ACTION_CLASSES.map((c) => [c.key, c]))

export function actionClass(key: string): ActionClass | null {
  return BY_KEY.get(key) ?? null
}

export function isActionClassKey(key: string): key is ActionClassKey {
  return BY_KEY.has(key)
}

/** The level each preset gives each class, before the class's own limits apply. */
export const PRESET_LEVELS: Record<Preset, Record<ActionClassKey, Level>> = {
  careful: {
    'ingest.read': 'auto',
    'entry.create': 'approve',
    'entry.stats': 'approve',
    'report.draft': 'approve',
    'report.send': 'approve',
    'content.draft': 'approve',
    'content.publish': 'ask',
    'docs.comment': 'approve',
    'readiness.run': 'approve',
    'settings.change': 'ask',
  },
  balanced: {
    'ingest.read': 'auto',
    'entry.create': 'approve',
    'entry.stats': 'auto',
    'report.draft': 'approve',
    'report.send': 'approve',
    'content.draft': 'approve',
    'content.publish': 'ask',
    'docs.comment': 'approve',
    'readiness.run': 'auto',
    'settings.change': 'ask',
  },
  'hands-off': {
    'ingest.read': 'auto',
    'entry.create': 'auto',
    'entry.stats': 'auto',
    'report.draft': 'approve',
    'report.send': 'approve',
    'content.draft': 'approve',
    'content.publish': 'ask',
    'docs.comment': 'auto',
    'readiness.run': 'auto',
    'settings.change': 'ask',
  },
}

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value)
}

export function isPreset(value: unknown): value is Preset {
  return typeof value === 'string' && (PRESETS as readonly string[]).includes(value)
}

/** The highest level a class can be set to right now. */
export function ceilingFor(cls: ActionClass): Level {
  const cap = RANK[cls.maxLevel]
  const wired = cls.autoReady ? RANK.auto : RANK.approve
  const rank = Math.min(cap, wired)
  return LEVELS[rank]
}

/** Pull a level down to what the class allows. Never raises one. */
export function clampLevel(cls: ActionClass, level: Level): Level {
  return RANK[level] > RANK[ceilingFor(cls)] ? ceilingFor(cls) : level
}

/**
 * The level in force for one class: the person's override if they set one,
 * otherwise the preset's, in both cases held to the class's ceiling.
 */
export function resolveLevel(
  key: ActionClassKey,
  preset: Preset,
  override?: Level | null,
): Level {
  const cls = actionClass(key)
  if (!cls) return 'ask'
  const wanted = override ?? PRESET_LEVELS[preset][key]
  return clampLevel(cls, wanted)
}

/** Whether an agent may do this without a person approving it first. */
export function mayActAlone(key: ActionClassKey, preset: Preset, override?: Level | null): boolean {
  return resolveLevel(key, preset, override) === 'auto'
}

/** Whether a person may approve it (Ask means they do the action themselves). */
export function needsApproval(key: ActionClassKey, preset: Preset, override?: Level | null): boolean {
  return resolveLevel(key, preset, override) === 'approve'
}
