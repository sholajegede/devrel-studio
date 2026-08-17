import { ConvexError } from 'convex/values'
import { Doc, Id } from '../_generated/dataModel'
import { MutationCtx, QueryCtx } from '../_generated/server'
import { AnyCtx, getCurrentUser, requireCurrentUser } from './auth'
import { accessOf } from './plans'

// ── Workspace membership and roles ────────────────────────────────────────────
//
// Authorisation used to be "does this row's userId equal mine". It is now "am I
// a member of this row's workspace, with a high enough role". Everything that
// touches owned data resolves through this file.
//
// Roles are a ladder, not a set of flags. Each one includes everything below it:
//
//   viewer  read
//   editor  + create and update content and clients
//   admin   + delete, and manage the access codes on client dashboards
//   owner   + invite and remove people, and billing
//
// The owner is the billing subject: plan limits are read from their user
// record, which is what lets an invited member work without a plan of their own.

export type Role = 'owner' | 'admin' | 'editor' | 'viewer'

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 }

export function atLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum]
}

export interface WorkspaceContext {
  user: Doc<'users'>
  workspace: Doc<'workspaces'>
  workspaceId: Id<'workspaces'>
  role: Role
}

// ── Resolving the caller's workspace ──────────────────────────────────────────

async function membershipFor(
  ctx: AnyCtx,
  workspaceId: Id<'workspaces'>,
  userId: Id<'users'>,
) {
  return await ctx.db
    .query('memberships')
    .withIndex('by_workspace_and_user', (q) =>
      q.eq('workspaceId', workspaceId).eq('userId', userId),
    )
    .unique()
}

/**
 * The workspace this user is currently working in.
 *
 * Preference order: the one they explicitly switched to, then their personal
 * one, then whatever they were first invited to. Returns null when the user has
 * no memberships at all — which for an existing account means the workspace
 * migration has not run yet, not that anything is broken.
 */
export async function getCurrentWorkspace(
  ctx: AnyCtx,
): Promise<WorkspaceContext | null> {
  const user = await getCurrentUser(ctx)
  if (!user) return null

  if (user.activeWorkspaceId) {
    const membership = await membershipFor(ctx, user.activeWorkspaceId, user._id)
    const workspace = membership ? await ctx.db.get(user.activeWorkspaceId) : null
    if (membership && workspace) {
      return { user, workspace, workspaceId: workspace._id, role: membership.role }
    }
    // Falls through when the active workspace was deleted or the user was
    // removed from it — better to land somewhere valid than to error.
  }

  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .collect()

  if (memberships.length === 0) return null

  const workspaces = await Promise.all(
    memberships.map(async (membership) => ({
      membership,
      workspace: await ctx.db.get(membership.workspaceId),
    })),
  )

  const live = workspaces.filter(
    (entry): entry is { membership: Doc<'memberships'>; workspace: Doc<'workspaces'> } =>
      entry.workspace !== null,
  )
  if (live.length === 0) return null

  const preferred =
    live.find((entry) => entry.workspace.isPersonal && entry.workspace.ownerId === user._id) ??
    live[0]

  return {
    user,
    workspace: preferred.workspace,
    workspaceId: preferred.workspace._id,
    role: preferred.membership.role,
  }
}

/** As above, but throws. Use in mutations, and in queries that cannot degrade. */
export async function requireWorkspace(
  ctx: AnyCtx,
  minimumRole: Role = 'viewer',
): Promise<WorkspaceContext> {
  await requireCurrentUser(ctx)

  const context = await getCurrentWorkspace(ctx)
  if (!context) {
    throw new ConvexError('No workspace found for this account')
  }

  if (!atLeast(context.role, minimumRole)) {
    throw new ConvexError(deniedMessage(context.role, minimumRole))
  }

  // Anything above read requires a live access window. Checked against the
  // workspace owner, not the caller: an invited editor works under the owner's
  // subscription and should not need one of their own.
  if (atLeast(minimumRole, 'editor')) {
    const owner = await ctx.db.get(context.workspace.ownerId)
    const access = accessOf(owner)

    if (!access.canWrite) {
      throw new ConvexError(
        access.state === 'expired' && owner?.accessUntil
          ? 'This workspace’s access has ended. Email support@devrel.studio to extend it.'
          : 'Your free trial has ended. Email support@devrel.studio to keep going.',
      )
    }
  }

  return context
}

function deniedMessage(role: Role, minimum: Role): string {
  if (role === 'viewer') {
    return 'Your role is view-only, so you cannot change anything in this workspace'
  }
  if (minimum === 'owner') {
    return 'Only the workspace owner can do that'
  }
  return `This needs ${minimum} access — your role is ${role}`
}

// ── Document access ───────────────────────────────────────────────────────────

/** Tables scoped to a workspace. */
export type WorkspaceTable = 'contentEntries' | 'clients'

/**
 * Read a document only if the caller can see its workspace. Returns null rather
 * than throwing, matching the query convention in model/auth.ts.
 *
 * Rows written before the migration have no `workspaceId`; those fall back to
 * the original userId comparison so nothing disappears mid-migration.
 */
export async function readInWorkspace<T extends WorkspaceTable>(
  ctx: AnyCtx,
  id: Id<T>,
): Promise<Doc<T> | null> {
  const user = await getCurrentUser(ctx)
  if (!user) return null

  const doc = (await ctx.db.get(id)) as unknown as Doc<WorkspaceTable> | null
  if (!doc) return null

  if (!doc.workspaceId) {
    return doc.userId === user._id ? (doc as unknown as Doc<T>) : null
  }

  const membership = await membershipFor(ctx, doc.workspaceId, user._id)
  return membership ? (doc as unknown as Doc<T>) : null
}

/**
 * Load a document and assert the caller may act on it at `minimumRole`. Throws —
 * use in mutations.
 */
export async function requireInWorkspace<T extends WorkspaceTable>(
  ctx: AnyCtx,
  id: Id<T>,
  minimumRole: Role = 'editor',
): Promise<{ user: Doc<'users'>; doc: Doc<T>; role: Role }> {
  const user = await requireCurrentUser(ctx)

  const doc = (await ctx.db.get(id)) as unknown as Doc<WorkspaceTable> | null
  if (!doc) throw new ConvexError('Not found')

  // Pre-migration row: the creator is the only person who can touch it.
  if (!doc.workspaceId) {
    if (doc.userId !== user._id) throw new ConvexError('Not authorized')
    return { user, doc: doc as unknown as Doc<T>, role: 'owner' }
  }

  const membership = await membershipFor(ctx, doc.workspaceId, user._id)
  if (!membership) throw new ConvexError('Not authorized')

  if (!atLeast(membership.role, minimumRole)) {
    throw new ConvexError(deniedMessage(membership.role, minimumRole))
  }

  return { user, doc: doc as unknown as Doc<T>, role: membership.role }
}

// ── Creation ──────────────────────────────────────────────────────────────────

/**
 * Ensure a user has a personal workspace, returning its id. Idempotent, so it is
 * safe to call on every sign-in.
 */
export async function ensurePersonalWorkspace(
  ctx: MutationCtx,
  user: Doc<'users'>,
): Promise<Id<'workspaces'>> {
  const owned = await ctx.db
    .query('workspaces')
    .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
    .collect()

  const existing = owned.find((workspace) => workspace.isPersonal)
  if (existing) {
    await ensureMembership(ctx, existing._id, user._id, 'owner')
    return existing._id
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  const workspaceId = await ctx.db.insert('workspaces', {
    name: name ? `${name}'s workspace` : 'My workspace',
    ownerId: user._id,
    isPersonal: true,
    createdAt: new Date().toISOString(),
  })

  await ensureMembership(ctx, workspaceId, user._id, 'owner')

  if (!user.activeWorkspaceId) {
    await ctx.db.patch(user._id, { activeWorkspaceId: workspaceId })
  }

  return workspaceId
}

export async function ensureMembership(
  ctx: MutationCtx,
  workspaceId: Id<'workspaces'>,
  userId: Id<'users'>,
  role: Role,
): Promise<Id<'memberships'>> {
  const existing = await membershipFor(ctx, workspaceId, userId)
  if (existing) {
    if (existing.role !== role) await ctx.db.patch(existing._id, { role })
    return existing._id
  }

  return await ctx.db.insert('memberships', {
    workspaceId,
    userId,
    role,
    createdAt: new Date().toISOString(),
  })
}

/**
 * The user whose plan governs a workspace. Limits and seats are the owner's, not
 * the acting member's — otherwise inviting someone would silently grant the
 * workspace whatever plan that person happened to have.
 */
export async function planHolder(
  ctx: QueryCtx | MutationCtx,
  workspace: Doc<'workspaces'>,
): Promise<Doc<'users'>> {
  const owner = await ctx.db.get(workspace.ownerId)
  if (!owner) throw new ConvexError('This workspace has no owner')
  return owner
}
