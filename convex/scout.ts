import { v } from 'convex/values'
import { internal } from './_generated/api'
import { Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { recordAudit } from './model/audit'
import { canonicalUrl, describeEntryProposal, proposalFingerprint } from '../lib/agents/proposals'
import {
  HASHNODE_ENDPOINT,
  HASHNODE_QUERY,
  MAX_PAGES,
  PROVIDER_PLATFORM,
  devtoUrl,
  newCandidates,
  parseDevtoPage,
  parseHashnodePage,
  type Candidate,
} from '../lib/agents/sources'

// ── Scout ─────────────────────────────────────────────────────────────────────
//
// Reads a linked source, finds posts that are not in Work yet, and puts each in
// the Inbox as a proposal. It never writes an entry itself: that is the
// `entry.create` action class, which stays at Approve until Scout has earned
// more trust. A failed read marks the source as having an error. It never turns
// into a count of zero.

const FETCH_TIMEOUT_MS = 15_000

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (response.status === 404) throw new Error('The source was not found. Check the name.')
  if (response.status === 429) throw new Error('The source asked us to slow down. Scout will try again tomorrow.')
  if (!response.ok) throw new Error(`The source answered with status ${response.status}.`)
  return await response.json()
}

async function readDevto(handle: string): Promise<Candidate[]> {
  const all: Candidate[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const parsed = parseDevtoPage(await fetchJson(devtoUrl(handle, page)))
    if (parsed.error) throw new Error(parsed.error)
    all.push(...parsed.items)
    if (parsed.done) break
  }
  return all
}

async function readHashnode(host: string): Promise<Candidate[]> {
  const all: Candidate[] = []
  let after: string | undefined
  for (let page = 1; page <= MAX_PAGES; page++) {
    const parsed = parseHashnodePage(
      await fetchJson(HASHNODE_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: HASHNODE_QUERY, variables: { host, after } }),
      }),
    )
    if (parsed.error) throw new Error(parsed.error)
    all.push(...parsed.items)
    if (parsed.done) break
    after = parsed.cursor
  }
  return all
}

export const getConnection = internalQuery({
  args: { id: v.id('connections') },
  handler: async (ctx, { id }) => {
    const connection = await ctx.db.get(id)
    if (!connection) return null
    const settings = await ctx.db
      .query('agentSettings')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', connection.workspaceId))
      .unique()
    return { connection, paused: settings?.paused ?? false }
  },
})

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('connections').collect()
    return rows.map((c) => c._id)
  },
})

export const markSyncing = internalMutation({
  args: { id: v.id('connections') },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: 'syncing' })
  },
})

export const markFailed = internalMutation({
  args: { id: v.id('connections'), error: v.string() },
  handler: async (ctx, { id, error }) => {
    // Keep the last good count. A failed read means "stale", not "zero".
    await ctx.db.patch(id, { status: 'error', lastError: error.slice(0, 300), lastSyncAt: Date.now() })
  },
})

/** Dedupe against Work and the Inbox, then write proposals. Safe to run twice. */
export const ingest = internalMutation({
  args: {
    id: v.id('connections'),
    candidates: v.array(
      v.object({
        title: v.string(),
        link: v.string(),
        publicationDate: v.string(),
        externalId: v.string(),
      }),
    ),
  },
  handler: async (ctx, { id, candidates }) => {
    const connection = await ctx.db.get(id)
    if (!connection) return { proposed: 0, read: candidates.length }

    const entries = await ctx.db
      .query('contentEntries')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', connection.workspaceId))
      .collect()
    const known = new Set<string>()
    for (const entry of entries) {
      const key = canonicalUrl(entry.link)
      if (key) known.add(key)
      // A reshare link counts too: a cross-post is the same piece, not a new one.
      for (const reshare of entry.reshares ?? []) {
        const reshareKey = canonicalUrl(reshare.link)
        if (reshareKey) known.add(reshareKey)
      }
    }
    // Any proposal ever made for a page, in any state, blocks a second one.
    // A dismissed page stays dismissed.
    const proposals = await ctx.db
      .query('proposals')
      .withIndex('by_workspace_and_status', (q) => q.eq('workspaceId', connection.workspaceId))
      .collect()
    for (const proposal of proposals) {
      const key = canonicalUrl(proposal.payload.link)
      if (key) known.add(key)
    }

    const fresh = newCandidates(candidates, known)
    const platform = PROVIDER_PLATFORM[connection.provider]
    for (const candidate of fresh) {
      const draft = {
        client: connection.clientSlug,
        title: candidate.title.slice(0, 200),
        link: candidate.link,
        platform,
        publicationDate: candidate.publicationDate,
      }
      await ctx.db.insert('proposals', {
        workspaceId: connection.workspaceId,
        kind: 'entry.create',
        status: 'pending',
        source: 'Scout',
        summary: describeEntryProposal(draft),
        evidence: [{ label: `Found on ${platform} (${connection.handle})`, url: candidate.link }],
        payload: draft,
        fingerprint: proposalFingerprint('entry.create', canonicalUrl(candidate.link)),
        createdBy: connection.createdBy,
        createdAt: Date.now(),
      })
    }

    await ctx.db.patch(id, {
      status: 'ok',
      lastError: undefined,
      lastSyncAt: Date.now(),
      itemsRead: candidates.length,
    })
    if (fresh.length > 0) {
      await recordAudit(
        ctx,
        { workspaceId: connection.workspaceId, user: null },
        {
          agentLabel: 'Scout',
          action: 'scout.propose',
          summary: `Found ${fresh.length} new ${fresh.length === 1 ? 'post' : 'posts'} on ${platform} and sent ${
            fresh.length === 1 ? 'it' : 'them'
          } to the Inbox.`,
          subjectKind: 'connection',
          subjectId: id,
        },
      )
    }
    return { proposed: fresh.length, read: candidates.length }
  },
})

export const syncConnection = internalAction({
  args: { id: v.id('connections') },
  handler: async (ctx, { id }) => {
    const found = await ctx.runQuery(internal.scout.getConnection, { id })
    if (!found) return
    // The kill switch. Nothing is read, and the source keeps its last state.
    if (found.paused) return

    const { connection } = found
    await ctx.runMutation(internal.scout.markSyncing, { id })
    try {
      const candidates =
        connection.provider === 'devto'
          ? await readDevto(connection.handle)
          : await readHashnode(connection.handle)
      await ctx.runMutation(internal.scout.ingest, { id, candidates })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The read failed.'
      await ctx.runMutation(internal.scout.markFailed, { id, error: message })
    }
  },
})

/** The daily run: one job per source, so one slow source cannot block the rest. */
export const syncAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const ids: Id<'connections'>[] = await ctx.runQuery(internal.scout.listAll, {})
    for (const id of ids) {
      await ctx.scheduler.runAfter(0, internal.scout.syncConnection, { id })
    }
  },
})
