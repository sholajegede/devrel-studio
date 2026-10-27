import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { recordAudit } from './model/audit'
import { getCurrentWorkspace, requireWorkspace } from './model/workspaces'
import { DEFAULT_PRESET, actionClass, clampLevel, isActionClassKey } from '../lib/agents/autonomy'

const levelValidator = v.union(v.literal('ask'), v.literal('approve'), v.literal('auto'))
const presetValidator = v.union(v.literal('careful'), v.literal('balanced'), v.literal('hands-off'))

const DEFAULT_BUDGET_USD = 0

/** The settings in force. A workspace that never saved any gets the safe defaults. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const current = await getCurrentWorkspace(ctx)
    if (!current) return null
    const row = await ctx.db
      .query('agentSettings')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', current.workspaceId))
      .unique()
    return {
      role: current.role,
      preset: row?.preset ?? DEFAULT_PRESET,
      overrides: row?.overrides ?? {},
      paused: row?.paused ?? false,
      monthlyBudgetUsd: row?.monthlyBudgetUsd ?? DEFAULT_BUDGET_USD,
      updatedAt: row?.updatedAt ?? null,
    }
  },
})

/** Owners and admins set autonomy. Every change is logged. */
export const save = mutation({
  args: {
    preset: presetValidator,
    overrides: v.record(v.string(), levelValidator),
    paused: v.boolean(),
    monthlyBudgetUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const who = await requireWorkspace(ctx, 'admin')

    if (!Number.isFinite(args.monthlyBudgetUsd) || args.monthlyBudgetUsd < 0 || args.monthlyBudgetUsd > 100000) {
      throw new ConvexError('Set a monthly budget between 0 and 100,000 US dollars.')
    }

    // Keep only known classes, and hold each to what the product allows.
    const overrides: Record<string, 'ask' | 'approve' | 'auto'> = {}
    for (const [key, level] of Object.entries(args.overrides)) {
      if (!isActionClassKey(key)) continue
      const cls = actionClass(key)
      if (cls) overrides[key] = clampLevel(cls, level)
    }

    const existing = await ctx.db
      .query('agentSettings')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', who.workspaceId))
      .unique()

    const next = {
      workspaceId: who.workspaceId,
      preset: args.preset,
      overrides,
      paused: args.paused,
      monthlyBudgetUsd: Math.round(args.monthlyBudgetUsd),
      updatedBy: who.user._id,
      updatedAt: Date.now(),
    }
    if (existing) await ctx.db.replace(existing._id, next)
    else await ctx.db.insert('agentSettings', next)

    const pausedChanged = (existing?.paused ?? false) !== args.paused
    await recordAudit(ctx, who, {
      action: pausedChanged ? (args.paused ? 'agents.pause' : 'agents.resume') : 'agents.settings',
      summary: pausedChanged
        ? args.paused
          ? 'Paused all agents.'
          : 'Resumed agents.'
        : `Set autonomy to ${args.preset}.`,
      subjectKind: 'agentSettings',
    })
  },
})
