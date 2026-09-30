import { Id } from '../_generated/dataModel'
import { MutationCtx } from '../_generated/server'
import { EventContext, RawEvent, countersFor, dayKey, weekKey, type MetricKind } from '../../lib/jobs/analytics'

async function bump(ctx: MutationCtx, kind: MetricKind | 'week', bucket: string, event: string, dim: string, by = 1) {
  const row = await ctx.db
    .query('jobMetrics')
    .withIndex('by_key', (q) => q.eq('kind', kind).eq('bucket', bucket).eq('event', event).eq('dim', dim))
    .first()
  if (row) await ctx.db.patch(row._id, { count: row.count + by })
  else await ctx.db.insert('jobMetrics', { kind, bucket, event, dim, count: by })
}

/** Counts a visitor, a session or a first visit once per period. */
async function firstTime(ctx: MutationCtx, key: string): Promise<boolean> {
  const seen = await ctx.db.query('jobVisitorSeen').withIndex('by_key', (q) => q.eq('key', key)).first()
  if (seen) return false
  await ctx.db.insert('jobVisitorSeen', { key })
  return true
}

export interface WhoIs {
  visitor: string
  session?: string
  userId?: Id<'users'>
}

/** Writes one event: the raw row, then every counter it feeds. */
export async function recordEvent(
  ctx: MutationCtx,
  event: RawEvent,
  who: WhoIs,
  context: EventContext = {},
  now = Date.now(),
): Promise<void> {
  const day = dayKey(now)
  const week = weekKey(now)

  await ctx.db.insert('jobEvents', {
    ts: now,
    event: event.event,
    visitor: who.visitor,
    ...(who.userId ? { userId: who.userId } : {}),
    path: event.path,
    ...(event.slug ? { slug: event.slug } : {}),
    ...(event.company ? { company: event.company } : {}),
    ...(event.label ? { label: event.label } : {}),
    ...(event.n !== undefined ? { n: event.n } : {}),
    ...(context.device ? { device: context.device } : {}),
    ...(context.country ? { country: context.country } : {}),
  })

  for (const counter of countersFor(event, context)) {
    await bump(ctx, counter.kind, counter.kind === 'all' ? day : week, event.event, counter.dim)
  }
  // Time on page adds up: the counter for it holds seconds, not visits.
  if (event.event === 'page_leave' && event.n) await bump(ctx, 'all', day, 'seconds_on_page', 'all', event.n)
  if (event.n && event.event === 'search') await bump(ctx, 'all', day, 'search_results', 'all', event.n)
}

/** Once per visitor per day and week, and once per session and ever. */
export async function recordPresence(ctx: MutationCtx, visitor: string, session: string | undefined, now = Date.now()) {
  const day = dayKey(now)
  const week = weekKey(now)
  if (await firstTime(ctx, `d:${day}:${visitor}`)) await bump(ctx, 'all', day, 'visitor', 'all')
  if (await firstTime(ctx, `w:${week}:${visitor}`)) await bump(ctx, 'week', week, 'visitor', 'all')
  if (await firstTime(ctx, `v:${visitor}`)) await bump(ctx, 'all', day, 'new_visitor', 'all')
  if (session && (await firstTime(ctx, `s:${session}`))) await bump(ctx, 'all', day, 'session', 'all')
}

/** For events that happen on the server: the work is done for a known account. */
export async function logServerEvent(
  ctx: MutationCtx,
  userId: Id<'users'> | undefined,
  event: Omit<RawEvent, 'path'> & { path?: string },
): Promise<void> {
  try {
    await recordEvent(ctx, { path: '/server', ...event }, { visitor: userId ? `user:${userId}` : 'system', userId })
  } catch {
    // Analytics never gets to break the thing it is measuring.
  }
}
