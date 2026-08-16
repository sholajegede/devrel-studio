import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { Doc } from './_generated/dataModel'
import { requireCurrentUser } from './model/auth'
import {
  ensureMembership,
  getCurrentWorkspace,
  planHolder,
  requireWorkspace,
} from './model/workspaces'
import { planOf } from './model/plans'

// ── Workspace members ─────────────────────────────────────────────────────────
//
// An invitation now grants access. Accepting one creates a `memberships` row,
// and every query resolves data through the workspace rather than through a
// single user — see convex/model/workspaces.ts for the role ladder.
//
// The invite link carries a raw token; only its hash is stored, so a dump of
// this table yields no usable invitation. The token is generated in the Next.js
// layer because Convex mutations are deterministic and cannot produce
// randomness themselves.

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

const roleValidator = v.union(
  v.literal('admin'),
  v.literal('editor'),
  v.literal('viewer'),
)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function displayName(user: Doc<'users'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Everyone with access to the caller's current workspace. */
export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return []

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .collect()

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        if (!user) return null
        return {
          id: membership._id,
          userId: user._id,
          name: displayName(user),
          email: user.email,
          imageUrl: user.imageUrl,
          role: membership.role,
          joinedAt: membership.createdAt,
          isYou: user._id === context.user._id,
        }
      }),
    )

    // Owner first, then by role, so the list reads as a hierarchy.
    const order = { owner: 0, admin: 1, editor: 2, viewer: 3 } as const
    return members
      .filter((member): member is NonNullable<typeof member> => member !== null)
      .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name))
  },
})

/** Pending invites for the caller's workspace, expired ones filtered out. */
export const listInvites = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return []

    const invites = await ctx.db
      .query('workspaceInvites')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .collect()

    const now = Date.now()
    return invites
      .filter((invite) => invite.status === 'pending' && invite.expiresAt > now)
      .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt))
      .map((invite) => ({
        id: invite._id,
        email: invite.email,
        role: invite.role,
        invitedAt: invite.invitedAt,
        expiresAt: invite.expiresAt,
      }))
  },
})

/** Seat allowance and how much of it is spoken for. */
export const getSeatUsage = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return null

    const owner = await ctx.db.get(context.workspace.ownerId)
    if (!owner) return null

    const plan = planOf(owner)

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .collect()

    const invites = await ctx.db
      .query('workspaceInvites')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .collect()

    const now = Date.now()
    const pending = invites.filter(
      (invite) => invite.status === 'pending' && invite.expiresAt > now,
    ).length

    return {
      planName: plan.name,
      seats: plan.seats,
      // A pending invite holds a seat: it would be worse to let someone invite
      // five people onto a two-seat plan and fail only when they accept.
      used: memberships.length + pending,
      members: memberships.length,
      pending,
      yourRole: context.role,
    }
  },
})

/** Workspaces the caller can switch between. */
export const listMyWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return []

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', context.user._id))
      .collect()

    const workspaces = await Promise.all(
      memberships.map(async (membership) => {
        const workspace = await ctx.db.get(membership.workspaceId)
        if (!workspace) return null
        return {
          id: workspace._id,
          name: workspace.name,
          isPersonal: workspace.isPersonal,
          role: membership.role,
          isActive: workspace._id === context.workspaceId,
        }
      }),
    )

    return workspaces.filter((w): w is NonNullable<typeof w> => w !== null)
  },
})

/**
 * ⚠ PUBLIC — unauthenticated. Renders the "you've been invited" screen before
 * the recipient has an account. Deliberately returns no member list, no content
 * counts and no email address other than the one already in the link's inbox.
 */
export const getInviteByToken = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query('workspaceInvites')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', args.tokenHash))
      .first()

    if (!invite) return { valid: false as const, reason: 'not-found' as const }
    if (invite.status === 'revoked') {
      return { valid: false as const, reason: 'revoked' as const }
    }
    if (invite.status === 'accepted') {
      return { valid: false as const, reason: 'already-accepted' as const }
    }
    if (invite.expiresAt < Date.now()) {
      return { valid: false as const, reason: 'expired' as const }
    }

    const workspace = invite.workspaceId ? await ctx.db.get(invite.workspaceId) : null
    const inviter = await ctx.db.get(invite.ownerId)

    if (!workspace) return { valid: false as const, reason: 'not-found' as const }

    return {
      valid: true as const,
      email: invite.email,
      role: invite.role,
      workspaceName: workspace.name,
      inviterName: inviter ? displayName(inviter) : 'Someone',
    }
  },
})

// ── Writes ────────────────────────────────────────────────────────────────────

export const inviteMember = mutation({
  args: {
    email: v.string(),
    role: roleValidator,
    // Hashed in the Next.js layer; see lib/manager-auth.ts.
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, workspace, workspaceId } = await requireWorkspace(ctx, 'owner')
    const email = args.email.trim().toLowerCase()

    if (!EMAIL_PATTERN.test(email)) {
      throw new ConvexError('Enter a valid email address')
    }

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect()

    for (const membership of memberships) {
      const member = await ctx.db.get(membership.userId)
      if (member?.email.toLowerCase() === email) {
        throw new ConvexError(
          member._id === user._id
            ? 'You already have access to this workspace'
            : `${email} is already a member`,
        )
      }
    }

    const invites = await ctx.db
      .query('workspaceInvites')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect()

    const now = Date.now()
    const live = invites.filter(
      (invite) => invite.status === 'pending' && invite.expiresAt > now,
    )

    if (live.some((invite) => invite.email === email)) {
      throw new ConvexError(`${email} already has a pending invitation`)
    }

    const plan = planOf(await planHolder(ctx, workspace))
    if (memberships.length + live.length >= plan.seats) {
      throw new ConvexError(
        `The ${plan.name} plan includes ${plan.seats} seat${
          plan.seats === 1 ? '' : 's'
        }. Upgrade to invite more people.`,
      )
    }

    const id = await ctx.db.insert('workspaceInvites', {
      ownerId: user._id,
      workspaceId,
      email,
      role: args.role,
      status: 'pending',
      tokenHash: args.tokenHash,
      invitedAt: new Date().toISOString(),
      expiresAt: now + INVITE_TTL_MS,
    })

    return { ok: true, id, workspaceName: workspace.name, inviterName: displayName(user) }
  },
})

/**
 * Claim an invitation. Called after the recipient signs in, so the account
 * exists by the time we get here.
 *
 * The email on the invite is not enforced against the signed-in account: the
 * token is the credential, and requiring an exact address match would strand
 * anyone who signs in with a Google alias of the address they were invited at.
 */
export const acceptInvite = mutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    const invite = await ctx.db
      .query('workspaceInvites')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', args.tokenHash))
      .first()

    if (!invite) throw new ConvexError('That invitation link is not valid')
    if (invite.status === 'revoked') throw new ConvexError('That invitation was revoked')
    if (invite.status === 'accepted') {
      throw new ConvexError('That invitation has already been used')
    }
    if (invite.expiresAt < Date.now()) throw new ConvexError('That invitation has expired')
    if (!invite.workspaceId) throw new ConvexError('That invitation is no longer valid')

    const workspace = await ctx.db.get(invite.workspaceId)
    if (!workspace) throw new ConvexError('That workspace no longer exists')

    // Re-check seats at acceptance: the plan may have changed, or other invites
    // may have been claimed, since this link was sent.
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', invite.workspaceId!))
      .collect()

    const plan = planOf(await planHolder(ctx, workspace))
    const alreadyMember = memberships.some((m) => m.userId === user._id)

    if (!alreadyMember && memberships.length >= plan.seats) {
      throw new ConvexError(
        'This workspace has no seats left. Ask the owner to upgrade or free one up.',
      )
    }

    await ensureMembership(ctx, invite.workspaceId, user._id, invite.role)

    await ctx.db.patch(invite._id, {
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      acceptedBy: user._id,
    })

    // Drop them straight into the workspace they just joined.
    await ctx.db.patch(user._id, { activeWorkspaceId: invite.workspaceId })

    return { ok: true, workspaceId: invite.workspaceId, workspaceName: workspace.name }
  },
})

export const revokeInvite = mutation({
  args: { inviteId: v.id('workspaceInvites') },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireWorkspace(ctx, 'owner')

    const invite = await ctx.db.get(args.inviteId)
    if (!invite) throw new ConvexError('Invitation not found')
    if (invite.workspaceId !== workspaceId) throw new ConvexError('Not authorized')

    await ctx.db.delete(args.inviteId)
    return { ok: true }
  },
})

export const updateMemberRole = mutation({
  args: { membershipId: v.id('memberships'), role: roleValidator },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireWorkspace(ctx, 'owner')

    const membership = await ctx.db.get(args.membershipId)
    if (!membership) throw new ConvexError('Member not found')
    if (membership.workspaceId !== workspaceId) throw new ConvexError('Not authorized')
    if (membership.role === 'owner') {
      throw new ConvexError('The workspace owner’s role cannot be changed')
    }

    await ctx.db.patch(args.membershipId, { role: args.role })
    return { ok: true }
  },
})

export const removeMember = mutation({
  args: { membershipId: v.id('memberships') },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireWorkspace(ctx, 'owner')

    const membership = await ctx.db.get(args.membershipId)
    if (!membership) throw new ConvexError('Member not found')
    if (membership.workspaceId !== workspaceId) throw new ConvexError('Not authorized')
    if (membership.role === 'owner') {
      throw new ConvexError('The workspace owner cannot be removed')
    }

    // Leave their content in place — it belongs to the workspace, not to them —
    // but send them back to their own workspace on next load.
    const removed = await ctx.db.get(membership.userId)
    if (removed?.activeWorkspaceId === workspaceId) {
      await ctx.db.patch(removed._id, { activeWorkspaceId: undefined })
    }

    await ctx.db.delete(args.membershipId)
    return { ok: true }
  },
})

/** Switch which workspace the caller is looking at. */
export const switchWorkspace = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_workspace_and_user', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('userId', user._id),
      )
      .unique()

    if (!membership) throw new ConvexError('You are not a member of that workspace')

    await ctx.db.patch(user._id, { activeWorkspaceId: args.workspaceId })
    return { ok: true }
  },
})

/** Send the invitation email. Split out so a resend does not re-create the row. */
export const sendInviteEmail = mutation({
  args: {
    email: v.string(),
    inviterName: v.string(),
    role: v.string(),
    acceptUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, 'owner')

    await ctx.scheduler.runAfter(0, internal.email.sendWorkspaceInvite, {
      email: args.email,
      inviterName: args.inviterName,
      role: args.role,
      signUpUrl: args.acceptUrl,
    })

    return { ok: true }
  },
})
