import { Id } from '../_generated/dataModel'
import { QueryCtx } from '../_generated/server'
import { TrackableEntry, trackingLinkFor } from '../../lib/tracking'

/**
 * Fill an empty tracking link from the client's settings.
 *
 * Every path that creates an entry goes through this: the form, a CSV import
 * and an approved Scout proposal. A link someone typed is never replaced, and
 * packages and demos are left empty because their links live on GitHub, npm
 * and the demo site.
 */
export async function withTrackingLink<T extends TrackableEntry & { client: string; trackingLink: string }>(
  ctx: QueryCtx,
  workspaceId: Id<'workspaces'>,
  entry: T,
  clientCache?: Map<string, { trackingBase?: string; utmCampaign?: string } | null>,
): Promise<T> {
  if (entry.trackingLink.trim()) return entry
  if (entry.category === 'Package' || entry.category === 'Demo') return entry
  if (!entry.client) return entry

  let client = clientCache?.get(entry.client)
  if (client === undefined) {
    const rows = await ctx.db
      .query('clients')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect()
    client = rows.find((row) => row.slug === entry.client) ?? null
    clientCache?.set(entry.client, client)
  }

  const link = trackingLinkFor(entry, client)
  return link ? { ...entry, trackingLink: link } : entry
}
